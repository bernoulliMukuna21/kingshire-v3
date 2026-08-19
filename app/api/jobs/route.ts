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
import { captureServerEvent } from "@/lib/posthog-server";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
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

  if (organisationId) {
    const { data: subscription, error: subscriptionError } =
      await createServiceClient()
        .from("organisation_subscriptions")
        .select("status")
        .eq("organisation_id", organisationId)
        .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json(
        { error: "Unable to verify the Organisation subscription." },
        { status: 503 },
      );
    }
    // Organisations created before paid onboarding are intentionally
    // grandfathered. Once an Organisation has a subscription record, only an
    // active/trialling subscription may create new work.
    if (
      subscription &&
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      return NextResponse.json(
        {
          error:
            "Reactivate the Organisation subscription before posting new jobs.",
        },
        { status: 402 },
      );
    }
  }

  const {
    title,
    description,
    categories,
    budget,
    rate_type,
    deadline,
    invited_kinglancer_id,
    work_mode,
    location,
    scheduled_at,
    ends_at,
    days_on_site,
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

  const validWorkModes = ["online", "in_person", "hybrid"];
  if (!validWorkModes.includes(work_mode)) {
    return NextResponse.json(
      { error: "Choose where the job happens." },
      { status: 400 },
    );
  }
  const resolvedWorkMode = work_mode;
  const locationStr = typeof location === "string" ? location.trim() : "";
  let scheduledAtIso: string | null = null;
  let endsAtIso: string | null = null;
  let daysOnSite: number | null = null;
  if (resolvedWorkMode === "online" && !deadline) {
    return NextResponse.json(
      { error: "Add a deadline for online jobs." },
      { status: 400 },
    );
  }
  if (resolvedWorkMode === "in_person" || resolvedWorkMode === "hybrid") {
    if (!locationStr) {
      return NextResponse.json(
        { error: "Add the location for an in-person or hybrid job." },
        { status: 400 },
      );
    }
  }
  if (resolvedWorkMode === "in_person") {
    const startHasTime =
      typeof scheduled_at === "string" && /T\d{2}:\d{2}/.test(scheduled_at);
    const endHasTime =
      typeof ends_at === "string" && /T\d{2}:\d{2}/.test(ends_at);
    const start = new Date(scheduled_at);
    const end = new Date(ends_at);
    if (!startHasTime || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Add the start date and time." },
        { status: 400 },
      );
    }
    if (!endHasTime || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Add the end date and time." },
        { status: 400 },
      );
    }
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "The end time must be after the start time." },
        { status: 400 },
      );
    }
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (resolvedWorkMode === "hybrid") {
    daysOnSite = Number(days_on_site);
    if (!Number.isInteger(daysOnSite) || daysOnSite < 1 || daysOnSite > 6) {
      return NextResponse.json(
        {
          error: "Set how many days on-site per week (1–6) for a hybrid job.",
        },
        { status: 400 },
      );
    }
    const start = new Date(scheduled_at);
    const end = new Date(ends_at);
    if (!scheduled_at || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Add the start date." },
        { status: 400 },
      );
    }
    if (!ends_at || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Add the end date." }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json(
        { error: "The end date must be after the start date." },
        { status: 400 },
      );
    }
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }

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
    const job = await createJob(
      {
        client_id: user.id,
        created_by: user.id,
        organisation_id: organisationId,
        title: titleStr,
        description: descStr,
        categories,
        budget: normalizedBudget,
        rate_type: resolvedRateType,
        work_mode: resolvedWorkMode,
        location: resolvedWorkMode !== "online" ? locationStr : null,
        scheduled_at: scheduledAtIso,
        ends_at: endsAtIso,
        days_on_site: daysOnSite,
        invited_kinglancer_id: invitedKinglancerId,
        direct_request_status: invitedKinglancerId ? "pending" : null,
        deadline: deadline || null,
      },
      { useServiceRole: !!organisationId },
    );

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

    await captureServerEvent({
      distinctId: user.id,
      event: "job_posted",
      properties: {
        job_id: job.id,
        budget: normalizedBudget,
        category_count: categories.length,
        is_direct_request: Boolean(invitedKinglancerId),
        rate_type: resolvedRateType,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 },
    );
  }
}
