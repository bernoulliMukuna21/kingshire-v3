import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyWorkSubmitted } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";
import { getOrgOwnerContact } from "@/lib/organisations";

// POST /api/jobs/[id]/complete — kinglancer marks work as done
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Fetch job and verify the caller is the assigned kinglancer
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, kinglancer_id, client_id, organisation_id, title, posting_type")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.kinglancer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.posting_type === "role") {
    return NextResponse.json(
      {
        error:
          "Recurring roles don't use this action. End the role engagement from its own page instead.",
      },
      { status: 400 },
    );
  }

  if (job.status !== "in_progress") {
    return NextResponse.json(
      { error: "Job is not currently in progress" },
      { status: 409 },
    );
  }

  const serviceDb = createServiceClient();
  const { error } = await serviceDb
    .from("jobs")
    .update({ status: "completed" })
    .eq("id", jobId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update job status" },
      { status: 500 },
    );
  }

  // Notify whoever manages this job: the org owner if it's org-owned (the
  // original poster in client_id may not be who reviews applicants/work),
  // otherwise the client directly.
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

  if (recipient?.email) {
    notifyWorkSubmitted({
      clientId: recipient.userId,
      clientEmail: recipient.email,
      jobTitle: job.title,
      link: job.organisation_id
        ? `/dashboard/organisations/${job.organisation_id}/jobs/${jobId}`
        : undefined,
    }).catch(() => {});
  }

  await captureServerEvent({
    distinctId: user.id,
    event: "job_completed",
    properties: { job_id: jobId },
  });

  return NextResponse.json({ success: true });
}
