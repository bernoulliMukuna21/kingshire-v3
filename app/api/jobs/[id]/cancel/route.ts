import { refundJobPayment } from "@/lib/settlement/job-transfers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTransactionByJob } from "@/lib/db/transactions";
import { notifyJobCancelled } from "@/lib/notifications";
import { canManageJob } from "@/lib/organisations";
import { captureServerEvent } from "@/lib/posthog-server";
import { SUPPORT_EMAIL } from "@/lib/contact";

const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours

// POST /api/jobs/[id]/cancel
// Client (job owner) cancels a job posting.
//
// Allowed states:
//   open       → direct cancel; pending applications bulk-rejected; invited
//                kinglancer notified if this was a direct request.
//   in_progress → grace period check against transaction.created_at:
//                  • within 2 h: Stripe full refund + cancel + notify kinglancer
//                  • outside 2 h: 409 — must use the dispute system
//
// All other states are rejected with 400.
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

  // Fetch the job with its client/kinglancer IDs and invited kinglancer.
  const { data: job } = await db
    .from("jobs")
    .select(
      "id, title, status, client_id, organisation_id, kinglancer_id, invited_kinglancer_id",
    )
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!(await canManageJob(job, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (job.status !== "open" && job.status !== "in_progress") {
    return NextResponse.json(
      {
        error:
          "This job cannot be cancelled. Only open or in-progress jobs can be cancelled.",
      },
      { status: 400 },
    );
  }

  // ── Open job: direct cancellation ──────────────────────────
  if (job.status === "open") {
    const { error } = await db.rpc("cancel_open_job", { p_job: jobId });
    if (error) {
      return NextResponse.json(
        {
          error:
            "The job changed or has an unresolved payment. Cancel the pending payment first; if it has completed or you have sent a bank transfer, contact support.",
          code: "JOB_CANCELLATION_BLOCKED",
        },
        { status: 409 },
      );
    }

    // Notify the invited kinglancer on a direct request (applicants don't
    // receive individual notifications for open-market cancellations).
    if (job.invited_kinglancer_id) {
      const { data: kl } = await db
        .from("profiles")
        .select("email")
        .eq("id", job.invited_kinglancer_id)
        .single();

      if (kl?.email) {
        notifyJobCancelled({
          recipientId: job.invited_kinglancer_id,
          recipientEmail: kl.email,
          jobTitle: job.title,
          refunded: false,
        }).catch(console.error);
      }
    }

    await captureServerEvent({
      distinctId: user.id,
      event: "job_cancelled",
      properties: { job_id: jobId, refunded: false },
    });

    return NextResponse.json({ success: true });
  }

  // ── In-progress job: grace-period refund ───────────────────
  const transaction = await getTransactionByJob(jobId);

  if (!transaction || transaction.status !== "held") {
    return NextResponse.json(
      { error: "No held transaction found for this job." },
      { status: 409 },
    );
  }

  // Bank-transfer jobs are refunded manually by our team — no Stripe refund.
  if (
    transaction.payment_method === "bank_transfer" ||
    !transaction.stripe_payment_intent_id
  ) {
    return NextResponse.json(
      {
        error: `This job was paid by bank transfer. To cancel it and arrange your refund, please contact support at ${SUPPORT_EMAIL}.`,
        code: "MANUAL_REFUND_CONTACT_SUPPORT",
      },
      { status: 409 },
    );
  }

  const ageMs = Date.now() - new Date(transaction.created_at).getTime();
  if (ageMs > GRACE_PERIOD_MS) {
    return NextResponse.json(
      {
        error:
          "The 2-hour cancellation window has passed. Please raise a dispute if you need to resolve this job early.",
        code: "GRACE_PERIOD_EXPIRED",
      },
      { status: 409 },
    );
  }

  try {
    await refundJobPayment(transaction.id, { cancellation: true });
  } catch (error) {
    console.error("[cancel-job]", error);
    return NextResponse.json(
      {
        error:
          "Cancellation could not be settled. Check the payment status or contact support.",
      },
      { status: 409 },
    );
  }

  // Notify the kinglancer.
  if (job.kinglancer_id) {
    const { data: kl } = await db
      .from("profiles")
      .select("email")
      .eq("id", job.kinglancer_id)
      .single();

    if (kl?.email) {
      notifyJobCancelled({
        recipientId: job.kinglancer_id,
        recipientEmail: kl.email,
        jobTitle: job.title,
        refunded: true,
      }).catch(console.error);
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: "job_cancelled",
    properties: { job_id: jobId, refunded: true },
  });

  return NextResponse.json({ success: true, refunded: true });
}
