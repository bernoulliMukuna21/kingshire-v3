import { approveJobPayment } from "@/lib/settlement/job-payments";
import {
  refundJobPayment,
  reserveJobSettlement,
  finishJobSettlement,
} from "@/lib/settlement/job-transfers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { getTransactionByJob } from "@/lib/db/transactions";
import { notifyDisputeResolved } from "@/lib/notifications";

// POST /api/admin/disputes/[id]/resolve
// Admin-only. action = "release" (pay kinglancer) | "refund" (return to client)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: disputeId } = await params;

  // ── Auth: must be admin with valid session ─────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Validate body ──────────────────────────────────────
  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  if (action !== "release" && action !== "refund") {
    return NextResponse.json(
      { error: "action must be 'release' or 'refund'" },
      { status: 400 },
    );
  }

  // ── Fetch dispute + job ────────────────────────────────
  const db = createServiceClient();
  const { data: disputeRaw } = await db
    .from("disputes")
    .select(
      "id, status, job_id, job:jobs!job_id(id, title, status, client_id, kinglancer_id)",
    )
    .eq("id", disputeId)
    .single();

  if (!disputeRaw) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  type DisputeRow = {
    id: string;
    status: string;
    job_id: string;
    job: {
      id: string;
      title: string;
      status: string;
      client_id: string;
      kinglancer_id: string | null;
    } | null;
  };
  const dispute = disputeRaw as unknown as DisputeRow;

  if (dispute.status !== "open") {
    return NextResponse.json(
      { error: "This dispute has already been resolved." },
      { status: 409 },
    );
  }

  const job = dispute.job;
  if (!job || job.status !== "disputed") {
    return NextResponse.json(
      { error: "Job is not in a disputed state." },
      { status: 409 },
    );
  }

  const transaction = await getTransactionByJob(job.id);
  if (!transaction || transaction.status !== "held") {
    return NextResponse.json(
      { error: "No held transaction found for this job." },
      { status: 409 },
    );
  }

  try {
    if (action === "release") {
      await approveJobPayment(job.id, disputeId);
    } else if (transaction.payment_method === "bank_transfer") {
      const reservation = await reserveJobSettlement(
        transaction.id,
        "manual_refund",
        disputeId,
      );
      await finishJobSettlement(
        transaction.id,
        reservation.release_attempt_id,
        undefined,
        undefined,
        user.id,
      );
    } else {
      await refundJobPayment(transaction.id, { disputeId });
    }
  } catch (error) {
    console.error("[dispute/resolve]", error);
    return NextResponse.json(
      {
        error:
          "Settlement was not completed. Check its status before taking another action.",
      },
      { status: 409 },
    );
  }
  const { data: recipients } = await db
    .from("profiles")
    .select("id,email")
    .in(
      "id",
      [job.client_id, job.kinglancer_id].filter((id): id is string => !!id),
    );
  for (const recipient of recipients ?? []) {
    if (recipient.email)
      void notifyDisputeResolved({
        userId: recipient.id,
        userEmail: recipient.email,
        jobTitle: job.title,
        outcome: action,
      }).catch(console.error);
  }
  return NextResponse.json({ success: true });
}
