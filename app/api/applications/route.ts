import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createApplication, hasApplied } from "@/lib/db/applications";
import { getJobById } from "@/lib/db/jobs";
import {
  jobRequiresSubscriptionToApply,
  SMALL_JOB_THRESHOLD_GBP,
} from "@/lib/payments/policy";
import { hasEntitlement } from "@/lib/subscriptions";
import { notifyNewApplication } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";
import { resolveCvPath } from "@/lib/cv-storage";
import { getOrgOwnerContact } from "@/lib/organisations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Verify the user is a kinglancer and has a complete profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, bio, services")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "kinglancer") {
    return NextResponse.json(
      { error: "Only kinglancers can apply to jobs" },
      { status: 403 },
    );
  }

  const profileServices = (profile.services ?? []) as Array<{ rate: number }>;
  const isProfileComplete =
    !!profile.bio?.trim() && profileServices.some((s) => Number(s.rate) > 0);

  if (!isProfileComplete) {
    return NextResponse.json(
      {
        code: "PROFILE_INCOMPLETE",
        error:
          "Please complete your profile before applying — add an 'About you' section and set a rate on at least one service.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { job_id, cover_letter } = body;

  if (!job_id || !cover_letter?.trim()) {
    return NextResponse.json(
      { error: "Job ID and cover letter are required" },
      { status: 400 },
    );
  }

  const rawCv = body.cv_path ?? body.cv_url;
  if (typeof rawCv !== "string" || !rawCv.trim()) {
    return NextResponse.json(
      { error: "Please attach your CV to apply." },
      { status: 400 },
    );
  }
  const cvPath = resolveCvPath("job-application-cvs", rawCv, user.id);
  if (!cvPath) {
    return NextResponse.json({ error: "Invalid CV upload." }, { status: 400 });
  }

  // Verify the job exists and is open
  const job = await getJobById(job_id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "open") {
    return NextResponse.json(
      { error: "This job is no longer accepting applications" },
      { status: 409 },
    );
  }
  if (job.invited_kinglancer_id) {
    return NextResponse.json(
      { error: "Direct requests must be handled from the job page" },
      { status: 403 },
    );
  }

  // Small jobs are subscriber-only to apply to (direct requests are exempt —
  // they're handled above). Roles have no "budget" (recurring pay instead),
  // so the small-job gate never applies to them.
  if (
    job.posting_type !== "role" &&
    jobRequiresSubscriptionToApply(job.budget) &&
    !(await hasEntitlement(user.id, "kinglancer", "applyToSmallJobs"))
  ) {
    return NextResponse.json(
      {
        error: `Applying to jobs under £${SMALL_JOB_THRESHOLD_GBP} needs a Kinglancer subscription.`,
        code: "SMALL_JOB_SUBSCRIPTION_REQUIRED",
      },
      { status: 403 },
    );
  }

  // Prevent duplicate applications
  const alreadyApplied = await hasApplied(job_id, user.id);
  if (alreadyApplied) {
    return NextResponse.json(
      { error: "You have already applied to this job" },
      { status: 409 },
    );
  }

  // Fetch whoever should be notified: the org owner for an org-owned job
  // (client_id is just whoever originally posted it, not necessarily who
  // manages applicants), or the client directly for a personal job.
  const recipient = job.organisation_id
    ? await getOrgOwnerContact(job.organisation_id)
    : await supabase
        .from("profiles")
        .select("email")
        .eq("id", job.client_id)
        .single()
        .then(({ data }) =>
          data ? { userId: job.client_id, email: data.email } : null,
        );

  try {
    const application = await createApplication({
      job_id,
      kinglancer_id: user.id,
      cover_letter: cover_letter.trim(),
      cv_path: cvPath,
    });

    // Notify the client — fire-and-forget, never blocks the response
    if (recipient?.email) {
      notifyNewApplication({
        clientId: recipient.userId,
        clientEmail: recipient.email,
        jobTitle: job.title,
        jobId: job_id,
        link: job.organisation_id
          ? `/dashboard/organisations/${job.organisation_id}/jobs/${job_id}`
          : undefined,
      }).catch(() => {});
    }

    await captureServerEvent({
      distinctId: user.id,
      event: "job_application_submitted",
      properties: {
        application_id: application.id,
        job_id,
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 },
    );
  }
}
