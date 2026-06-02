import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  notifyDisputeRaised,
  notifyAdminDisputeRaised,
} from "@/lib/notifications";

// POST /api/jobs/[id]/dispute — either party raises a dispute
export async function POST(
  request: Request,
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

  const body = await request.json();
  const reason = (body?.reason ?? "").trim();

  if (!reason || reason.length < 10) {
    return NextResponse.json(
      {
        error:
          "Please provide a reason for the dispute (at least 10 characters).",
      },
      { status: 400 },
    );
  }

  // Fetch job — caller must be the client or kinglancer
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, client_id, kinglancer_id")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const isParty = job.client_id === user.id || job.kinglancer_id === user.id;
  if (!isParty) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["in_progress", "completed"].includes(job.status)) {
    return NextResponse.json(
      { error: "A dispute can only be raised on an active or completed job" },
      { status: 409 },
    );
  }

  // Freeze the job (service client — kinglancer no longer has SDK update rights on jobs)
  const serviceDb = createServiceClient();
  await serviceDb.from("jobs").update({ status: "disputed" }).eq("id", jobId);

  // Create dispute record
  const { error } = await serviceDb.from("disputes").insert({
    job_id: jobId,
    raised_by: user.id,
    reason,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to raise dispute" },
      { status: 500 },
    );
  }

  // Notify the other party
  const raisedBy = user.id === job.client_id ? "client" : "kinglancer";
  const recipientId = raisedBy === "client" ? job.kinglancer_id : job.client_id;

  // Always alert the admin inbox with full details
  const { data: raiser } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  notifyAdminDisputeRaised({
    jobId,
    jobTitle: job.title,
    raisedBy,
    raisedByEmail: raiser?.email ?? "unknown",
    reason,
  }).catch(() => {});

  if (recipientId) {
    const { data: recipient } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", recipientId)
      .single();

    if (recipient) {
      notifyDisputeRaised({
        recipientId,
        recipientEmail: recipient.email,
        jobTitle: job.title,
        raisedBy,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
