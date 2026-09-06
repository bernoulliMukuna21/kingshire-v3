import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getPendingPaymentAttemptByJob,
  markAttemptClientPaid,
} from "@/lib/db/payment-attempts";
import { canManageJob } from "@/lib/organisations";
import { notifyAdminManualTransferSent } from "@/lib/notifications";

// POST /api/jobs/[id]/mark-transfer-sent
// Client tells us they've sent the bank transfer. Signal only — the admin still
// verifies against the bank before confirming funds.
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

  const db = createServiceClient();
  const { data: job } = await db
    .from("jobs")
    .select("id, client_id, organisation_id, title")
    .eq("id", jobId)
    .single();
  if (!job || !(await canManageJob(job, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attempt = await getPendingPaymentAttemptByJob(jobId);
  if (!attempt || attempt.method !== "bank_transfer") {
    return NextResponse.json(
      { error: "No pending bank transfer for this job." },
      { status: 404 },
    );
  }

  // Idempotent — only stamp + notify the first time.
  if (!attempt.client_marked_paid_at) {
    await markAttemptClientPaid(attempt.id);
    notifyAdminManualTransferSent({
      jobTitle: job.title,
      clientEmail: user.email ?? "a client",
      reference: attempt.id.slice(0, 8),
      amount: attempt.amount + attempt.platform_fee_client,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
