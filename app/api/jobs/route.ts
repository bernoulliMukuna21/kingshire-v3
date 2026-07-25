import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenJobs, createJob } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { emailJobAlert } from "@/lib/notifications";
import { requireOrganisationPermission } from "@/lib/organisations";

export async function GET() {
  try {
    const jobs = await getOpenJobs();
    return NextResponse.json(jobs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const organisationId =
    typeof body.organisation_id === "string" ? body.organisation_id : null;

  // Personal jobs require Client mode. Organisation jobs require membership.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const organisationMembership = organisationId
    ? await requireOrganisationPermission(
        organisationId,
        user.id,
        "manage_jobs",
      )
    : null;

  if (
    (!organisationId && (!profile || profile.role !== "client")) ||
    (organisationId && !organisationMembership)
  ) {
    return NextResponse.json(
      { error: "You do not have permission to post this job." },
      { status: 403 },
    );
  }

  const {
    title,
    description,
    categories,
    budget,
    rate_type,
    deadline,
    invited_kinglancer_id,
  } = body;

  const titleStr = (title ?? "").trim();
  const descStr = (description ?? "").trim();
  const budgetNum = Number(budget);
  const normalizedBudget = normalizeCurrencyAmount(budgetNum);

  if (!titleStr || !descStr || !categories?.length || !budget)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  if (titleStr.length < 3 || titleStr.length > 120)
    return NextResponse.json(
      { error: "Title must be between 3 and 120 characters." },
      { status: 400 },
    );
  if (descStr.length < 10 || descStr.length > 2000)
    return NextResponse.json(
      { error: "Description must be between 10 and 2000 characters." },
      { status: 400 },
    );
  if (
    !Number.isFinite(budgetNum) ||
    !hasValidCurrencyPrecision(budget) ||
    normalizedBudget < 5 ||
    normalizedBudget > 50000
  )
    return NextResponse.json(
      { error: "Budget must be between £5 and £50,000 with up to 2 decimals." },
      { status: 400 },
    );
  if (
    !Array.isArray(categories) ||
    categories.some(
      (c: string) => !(JOB_CATEGORIES as readonly string[]).includes(c),
    )
  )
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (deadline) {
    const d = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d < today)
      return NextResponse.json(
        { error: "Deadline must be today or a future date." },
        { status: 400 },
      );
  }

  const validRateTypes = ["fixed", "per_hour", "per_day"];
  const resolvedRateType = validRateTypes.includes(rate_type)
    ? rate_type
    : "fixed";
  const invitedKinglancerId =
    typeof invited_kinglancer_id === "string" && invited_kinglancer_id.trim()
      ? invited_kinglancer_id.trim()
      : null;

  if (invitedKinglancerId) {
    const { data: invitedKinglancer } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", invitedKinglancerId)
      .eq("role", "kinglancer")
      .single();

    if (!invitedKinglancer) {
      return NextResponse.json(
        { error: "Selected Kinglancer was not found." },
        { status: 404 },
      );
    }
  }

  try {
    const job = await createJob({
      client_id: user.id,
      created_by: user.id,
      organisation_id: organisationId,
      title: titleStr,
      description: descStr,
      categories,
      budget: normalizedBudget,
      rate_type: resolvedRateType,
      invited_kinglancer_id: invitedKinglancerId,
      direct_request_status: invitedKinglancerId ? "pending" : null,
      deadline: deadline || null,
    }, { useServiceRole: !!organisationId });

    // MVP-safe fan-out: create bounded in-app notifications only.
    // Avoid sending one email per kinglancer during the job-post request.
    const { data: kinglancers } = invitedKinglancerId
      ? await supabase
          .from("profiles")
          .select("id, email")
          .eq("id", invitedKinglancerId)
          .limit(1)
      : await supabase
          .from("profiles")
          .select("id, email")
          .eq("role", "kinglancer")
          .order("jobs_completed", { ascending: false })
          .limit(50);

    if (kinglancers?.length) {
      await createServiceClient()
        .from("notifications")
        .insert(
          kinglancers.map((k) => ({
            user_id: k.id,
            type: invitedKinglancerId ? "direct_request" : "new_job",
            title: invitedKinglancerId
              ? "New direct job request"
              : "New job posted",
            body: invitedKinglancerId
              ? `You have a direct job request: "${job.title}".`
              : `A new job has just been posted: "${job.title}". Be one of the first to apply!`,
            link: `/jobs/${job.id}`,
          })),
        )
        .then(() => null);
    }

    // Fire-and-forget email fan-out — does not block the HTTP response.
    // ENABLE_EMAIL must be true in the environment for emails to actually send.
    if (kinglancers?.length) {
      Promise.allSettled(
        kinglancers
          .filter((k) => k.email)
          .map((k) =>
            emailJobAlert({
              to: k.email as string,
              jobTitle: job.title,
              jobId: job.id,
              isDirect: !!invitedKinglancerId,
            }),
          ),
      ).catch(() => {});
    }

    if (!invitedKinglancerId) {
      revalidateTag("open-jobs", "max");
    }

    return NextResponse.json(job, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 },
    );
  }
}
