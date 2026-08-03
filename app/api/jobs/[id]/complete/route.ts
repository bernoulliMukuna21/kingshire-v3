import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyWorkSubmitted } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";

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
    .select("id, status, kinglancer_id, client_id, title")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.kinglancer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  // Notify client
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", job.client_id)
    .single();

  if (clientProfile?.email) {
    notifyWorkSubmitted({
      clientId: job.client_id,
      clientEmail: clientProfile.email,
      jobTitle: job.title,
    }).catch(() => {});
  }

  await captureServerEvent({
    distinctId: user.id,
    event: "job_completed",
    properties: { job_id: jobId },
  });

  return NextResponse.json({ success: true });
}
