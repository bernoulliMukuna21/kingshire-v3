import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createApplication, hasApplied } from "@/lib/db/applications";
import { getJobById } from "@/lib/db/jobs";
import { notifyNewApplication } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";

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

  // Prevent duplicate applications
  const alreadyApplied = await hasApplied(job_id, user.id);
  if (alreadyApplied) {
    return NextResponse.json(
      { error: "You have already applied to this job" },
      { status: 409 },
    );
  }

  // Fetch the client's email now, while the request context is still live
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", job.client_id)
    .single();

  try {
    const application = await createApplication({
      job_id,
      kinglancer_id: user.id,
      cover_letter: cover_letter.trim(),
    });

    // Notify the client — fire-and-forget, never blocks the response
    if (clientProfile?.email) {
      notifyNewApplication({
        clientId: job.client_id,
        clientEmail: clientProfile.email,
        jobTitle: job.title,
        jobId: job_id,
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
