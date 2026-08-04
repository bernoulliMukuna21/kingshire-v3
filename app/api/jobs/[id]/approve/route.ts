import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  updateTransactionStatusByJobId,
  getTransactionByJob,
} from "@/lib/db/transactions";
import {
  notifyPaymentReleased,
  notifyPayoutClaimReady,
  notifyReviewRequestsForJob,
} from "@/lib/notifications";
import {
  getOrCreateStripeAccount,
  createOnboardingLink,
  fireTransfer,
} from "@/lib/stripe-connect";
import { canManageJob } from "@/lib/organisations";
import { captureServerEvent } from "@/lib/posthog-server";

// POST /api/jobs/[id]/approve — client approves completed work, releases payment
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

  // Fetch job and verify caller is the client
  const { data: job } = await createServiceClient()
    .from("jobs")
    .select("id, status, client_id, organisation_id, kinglancer_id, title")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!(await canManageJob(job, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "Work has not been marked as complete yet" },
      { status: 409 },
    );
  }

  const transaction = await getTransactionByJob(jobId);
  if (!transaction || transaction.status !== "held") {
    return NextResponse.json(
      { error: "No held payment found for this job" },
      { status: 409 },
    );
  }

  if (!job.kinglancer_id) {
    return NextResponse.json(
      { error: "No kinglancer assigned to this job" },
      { status: 409 },
    );
  }

  const { data: kinglancerProfile } = await supabase
    .from("profiles")
    .select("email, full_name, stripe_account_id, stripe_onboarding_complete")
    .eq("id", job.kinglancer_id)
    .single();

  // A missing profile or email is a data-integrity problem — fail hard so the
  // client retries rather than silently returning success with nothing released.
  if (!kinglancerProfile?.email) {
    console.error(
      `[approve] Kinglancer profile/email not found for ${job.kinglancer_id}`,
    );
    return NextResponse.json(
      { error: "Kinglancer profile not found" },
      { status: 500 },
    );
  }

  const netAmount = transaction.amount - transaction.platform_fee_kinglancer;
  const serviceDb = createServiceClient();

  if (kinglancerProfile.stripe_onboarding_complete) {
    // Attempt the Stripe transfer FIRST. Only release if it succeeds.
    // This prevents the kinglancer from being told "payment released" when
    // the transfer actually failed and stripe_transfer_id is still null.
    const amountPence = Math.round(netAmount * 100);
    try {
      await fireTransfer({
        transactionId: transaction.id,
        amountPence,
        destinationAccountId: kinglancerProfile.stripe_account_id!,
        jobId,
        paymentIntentId: transaction.stripe_payment_intent_id ?? undefined,
      });
    } catch (err) {
      console.error("[approve] Stripe transfer failed:", err);
      return NextResponse.json(
        { error: "Payment transfer failed. Please try again." },
        { status: 502 },
      );
    }
    // Transfer succeeded — now persist the state change and notify.
    await updateTransactionStatusByJobId(
      jobId,
      "released",
      new Date().toISOString(),
    );
    await serviceDb.from("jobs").update({ status: "approved" }).eq("id", jobId);
    // Increment counter AFTER state is committed. The transaction is now
    // "released" so a retry from the client would hit the 409 guard above
    // — making this increment effectively idempotent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceDb as any)
      .rpc("increment_jobs_completed", { user_id: job.kinglancer_id })
      .then(() => null);
    notifyPaymentReleased({
      kinglancerId: job.kinglancer_id,
      kinglancerEmail: kinglancerProfile.email,
      jobTitle: job.title,
      amount: netAmount,
    }).catch(() => {});
  } else {
    // Kinglancer hasn't set up payouts yet — send them the claim link.
    // No Stripe transfer attempted; mark released so the cron doesn't
    // re-trigger and so the auto-release cron's fireTransfer will run
    // once they complete onboarding (via account.updated webhook).
    const accountId = await getOrCreateStripeAccount(
      job.kinglancer_id,
      kinglancerProfile.email,
      kinglancerProfile.stripe_account_id,
      kinglancerProfile.full_name ?? undefined,
    );
    const onboardingUrl = await createOnboardingLink(accountId);
    await updateTransactionStatusByJobId(
      jobId,
      "released",
      new Date().toISOString(),
    );
    await serviceDb.from("jobs").update({ status: "approved" }).eq("id", jobId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceDb as any)
      .rpc("increment_jobs_completed", { user_id: job.kinglancer_id })
      .then(() => null);
    notifyPayoutClaimReady({
      kinglancerId: job.kinglancer_id,
      kinglancerEmail: kinglancerProfile.email,
      jobTitle: job.title,
      amount: netAmount,
      onboardingUrl,
    }).catch(() => {});
  }

  // Both parties can now review each other (double-blind, 7-day window).
  notifyReviewRequestsForJob(jobId, job.title).catch(() => {});

  // Invalidate all kinglancer profile caches — jobs_completed changed.
  revalidateTag("kinglancer-profiles", { expire: 0 });

  await captureServerEvent({
    distinctId: user.id,
    event: "payment_released",
    properties: {
      job_id: jobId,
      amount: netAmount,
      payout_onboarding_complete: kinglancerProfile.stripe_onboarding_complete,
    },
  });

  return NextResponse.json({ success: true });
}
