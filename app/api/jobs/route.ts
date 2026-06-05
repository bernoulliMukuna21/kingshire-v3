import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenJobs, createJob } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";

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

  // Verify the user is a client
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "client") {
    return NextResponse.json(
      { error: "Only clients can post jobs" },
      { status: 403 },
    );
  }

  const body = await request.json();
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
    if (isNaN(d.getTime()) || d <= new Date())
      return NextResponse.json(
        { error: "Deadline must be a future date." },
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
      title: titleStr,
      description: descStr,
      categories,
      budget: normalizedBudget,
      rate_type: resolvedRateType,
      invited_kinglancer_id: invitedKinglancerId,
      direct_request_status: invitedKinglancerId ? "pending" : null,
      deadline: deadline || null,
    });

    // MVP-safe fan-out: create bounded in-app notifications only.
    // Avoid sending one email per kinglancer during the job-post request.
    const { data: kinglancers } = invitedKinglancerId
      ? await supabase
          .from("profiles")
          .select("id")
          .eq("id", invitedKinglancerId)
          .limit(1)
      : await supabase
          .from("profiles")
          .select("id")
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

    return NextResponse.json(job, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 },
    );
  }
}
