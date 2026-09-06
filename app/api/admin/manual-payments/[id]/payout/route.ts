import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { recordManualPayout } from "@/lib/db/transactions";
import {
  notifyPaymentReleased,
  notifyReviewRequestsForJob,
} from "@/lib/notifications";

// POST /api/admin/manual-payments/[id]/payout
// Admin records that the worker has been paid by hand. [id] = job id.
// The manual equivalent of fireTransfer — releases the held escrow.
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reference =
    typeof body.reference === "string"
      ? body.reference.trim().slice(0, 200)
      : "";
  if (!reference) {
    return NextResponse.json(
      { error: "A payout reference is required." },
      { status: 400 },
    );
  }

  const tx = await recordManualPayout(jobId, { reference, adminId: user.id });
  if (!tx) {
    return NextResponse.json(
      { error: "No held bank-transfer payment awaiting payout for this job." },
      { status: 409 },
    );
  }

  const db = createServiceClient();
  const [{ data: worker }, { data: job }] = await Promise.all([
    db.from("profiles").select("email").eq("id", tx.kinglancer_id).single(),
    db.from("jobs").select("title").eq("id", jobId).single(),
  ]);
  const netAmount = tx.amount - tx.platform_fee_kinglancer;
  if (worker?.email && job?.title) {
    notifyPaymentReleased({
      kinglancerId: tx.kinglancer_id,
      kinglancerEmail: worker.email,
      jobTitle: job.title,
      amount: netAmount,
    }).catch(() => {});
  }
  notifyReviewRequestsForJob(jobId, job?.title ?? "your job").catch(() => {});

  return NextResponse.json({ success: true });
}
