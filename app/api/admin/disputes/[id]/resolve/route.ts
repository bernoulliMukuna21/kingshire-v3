import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import {
  fireTransfer,
  getOrCreateStripeAccount,
  createOnboardingLink,
} from "@/lib/stripe-connect";
import { getTransactionByJob } from "@/lib/db/transactions";
import { hasEntitlement } from "@/lib/subscriptions";
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

  // ── Fetch both party profiles for notifications ────────
  const [clientResult, kinglancerResult] = await Promise.all([
    db
      .from("profiles")
      .select("email, full_name")
      .eq("id", job.client_id)
      .single(),
    job.kinglancer_id
      ? db
          .from("profiles")
          .select(
            "email, full_name, stripe_account_id, stripe_onboarding_complete",
          )
          .eq("id", job.kinglancer_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const clientProfile = clientResult.data;
  const kinglancerProfile = kinglancerResult.data as {
    email: string;
    full_name: string | null;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
  } | null;

  // Release payouts follow the worker's subscription: unsubscribed workers are
  // paid by hand (no Stripe Connect). Refunds still follow the funding method.
  const workerStripePayout = job.kinglancer_id
    ? await hasEntitlement(job.kinglancer_id, "kinglancer", "stripePayout")
    : false;

  // ── Execute the resolution ─────────────────────────────
  // Manual (bank transfer) dispute: no Stripe. Release leaves the escrow held
  // and approves the job so it lands in the Awaiting-payout queue (paid via the
  // worker's payout link); refund marks it refunded for the admin to return by
  // bank. The money moves by hand either way.
  if (transaction.payment_method === "bank_transfer") {
    if (action === "release") {
      if (!job.kinglancer_id) {
        return NextResponse.json(
          { error: "No kinglancer assigned to this job." },
          { status: 409 },
        );
      }
      await Promise.all([
        db.from("jobs").update({ status: "approved" }).eq("id", job.id),
        db
          .from("disputes")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disputeId),
      ]);
      if (kinglancerProfile?.email) {
        notifyDisputeResolved({
          userId: job.kinglancer_id,
          userEmail: kinglancerProfile.email,
          jobTitle: job.title,
          outcome: "release",
        }).catch(() => {});
      }
      if (clientProfile?.email) {
        notifyDisputeResolved({
          userId: job.client_id,
          userEmail: clientProfile.email,
          jobTitle: job.title,
          outcome: "release",
        }).catch(() => {});
      }
    } else {
      await Promise.all([
        db
          .from("transactions")
          .update({ status: "refunded" })
          .eq("job_id", job.id),
        db.from("jobs").update({ status: "cancelled" }).eq("id", job.id),
        db
          .from("disputes")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disputeId),
      ]);
      if (clientProfile?.email) {
        notifyDisputeResolved({
          userId: job.client_id,
          userEmail: clientProfile.email,
          jobTitle: job.title,
          outcome: "refund",
        }).catch(() => {});
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === "release") {
    if (!job.kinglancer_id || !kinglancerProfile) {
      return NextResponse.json(
        { error: "No kinglancer assigned to this job." },
        { status: 409 },
      );
    }

    // Unsubscribed worker — pay manually (leave escrow held, approve the job so
    // it lands in the Awaiting-payout queue). No Stripe Connect involved.
    if (!workerStripePayout) {
      await Promise.all([
        db
          .from("transactions")
          .update({ payout_method: "manual" })
          .eq("job_id", job.id)
          .eq("status", "held"),
        db.from("jobs").update({ status: "approved" }).eq("id", job.id),
        db
          .from("disputes")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disputeId),
      ]);
      if (kinglancerProfile.email) {
        notifyDisputeResolved({
          userId: job.kinglancer_id,
          userEmail: kinglancerProfile.email,
          jobTitle: job.title,
          outcome: "release",
        }).catch(() => {});
      }
      if (clientProfile?.email) {
        notifyDisputeResolved({
          userId: job.client_id,
          userEmail: clientProfile.email,
          jobTitle: job.title,
          outcome: "release",
        }).catch(() => {});
      }
      return NextResponse.json({ success: true });
    }

    const netAmount = transaction.amount - transaction.platform_fee_kinglancer;
    const amountPence = Math.round(netAmount * 100);

    if (
      kinglancerProfile.stripe_onboarding_complete &&
      kinglancerProfile.stripe_account_id
    ) {
      try {
        await fireTransfer({
          transactionId: transaction.id,
          amountPence,
          destinationAccountId: kinglancerProfile.stripe_account_id,
          jobId: job.id,
          paymentIntentId: transaction.stripe_payment_intent_id ?? undefined,
        });
      } catch (err) {
        console.error("[dispute/resolve] Transfer failed:", err);
        return NextResponse.json(
          { error: "Stripe transfer failed. Please try again." },
          { status: 502 },
        );
      }
    } else {
      // Kinglancer not onboarded — create/get their account and send claim link
      const accountId = await getOrCreateStripeAccount(
        job.kinglancer_id,
        kinglancerProfile.email,
        kinglancerProfile.stripe_account_id,
        kinglancerProfile.full_name ?? undefined,
      );
      const onboardingUrl = await createOnboardingLink(accountId);
      // Notify kinglancer to claim payout via onboarding
      notifyDisputeResolved({
        userId: job.kinglancer_id,
        userEmail: kinglancerProfile.email,
        jobTitle: job.title,
        outcome: "release",
        claimUrl: onboardingUrl,
      }).catch(() => {});
    }

    await Promise.all([
      db
        .from("transactions")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("job_id", job.id),
      db.from("jobs").update({ status: "approved" }).eq("id", job.id),
      db
        .from("disputes")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", disputeId),
    ]);

    // Notify both parties
    if (kinglancerProfile.stripe_onboarding_complete) {
      notifyDisputeResolved({
        userId: job.kinglancer_id,
        userEmail: kinglancerProfile.email,
        jobTitle: job.title,
        outcome: "release",
      }).catch(() => {});
    }
    if (clientProfile?.email) {
      notifyDisputeResolved({
        userId: job.client_id,
        userEmail: clientProfile.email,
        jobTitle: job.title,
        outcome: "release",
      }).catch(() => {});
    }
  } else {
    // action === "refund"
    const totalCharged = transaction.amount + transaction.platform_fee_client;
    const amountPence = Math.round(totalCharged * 100);

    try {
      await stripe.refunds.create({
        payment_intent: transaction.stripe_payment_intent_id!,
        amount: amountPence,
      });
    } catch (err) {
      console.error("[dispute/resolve] Refund failed:", err);
      return NextResponse.json(
        { error: "Stripe refund failed. Please try again." },
        { status: 502 },
      );
    }

    await Promise.all([
      db
        .from("transactions")
        .update({ status: "refunded" })
        .eq("job_id", job.id),
      db.from("jobs").update({ status: "cancelled" }).eq("id", job.id),
      db
        .from("disputes")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", disputeId),
    ]);

    if (clientProfile?.email) {
      notifyDisputeResolved({
        userId: job.client_id,
        userEmail: clientProfile.email,
        jobTitle: job.title,
        outcome: "refund",
      }).catch(() => {});
    }
    if (job.kinglancer_id && kinglancerProfile?.email) {
      notifyDisputeResolved({
        userId: job.kinglancer_id,
        userEmail: kinglancerProfile.email,
        jobTitle: job.title,
        outcome: "refund",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
