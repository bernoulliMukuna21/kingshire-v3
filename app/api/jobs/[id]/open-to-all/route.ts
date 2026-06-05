import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// POST /api/jobs/[id]/open-to-all
// Converts a declined or cancelled direct request into an open marketplace listing.
// Only the job's client can call this, and only when the direct request is done.
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

  const { data: job } = await supabase
    .from("jobs")
    .select("id, client_id, status, direct_request_status")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.client_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (job.status !== "open") {
    return NextResponse.json(
      { error: "This job is no longer open." },
      { status: 409 },
    );
  }
  if (!["declined", "cancelled"].includes(job.direct_request_status ?? "")) {
    return NextResponse.json(
      { error: "This request has not been declined or cancelled." },
      { status: 409 },
    );
  }

  const db = createServiceClient();
  const { error } = await db
    .from("jobs")
    .update({
      invited_kinglancer_id: null,
      direct_request_status: null,
      direct_request_message: null,
      counter_budget: null,
      counter_rate_type: null,
      counter_deadline: null,
    })
    .eq("id", jobId)
    .eq("client_id", user.id)
    .in("direct_request_status", ["declined", "cancelled"]);

  if (error) {
    return NextResponse.json(
      { error: "Failed to open the listing. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
