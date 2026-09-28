import { createServiceClient } from "@/lib/supabase/service";
import { getTransactionByJob } from "@/lib/db/transactions";
import { hasEntitlement } from "@/lib/subscriptions";
import { shouldPayoutManually } from "@/lib/payments/policy";
import {
  getOrCreateStripeAccount,
  createOnboardingLink,
} from "@/lib/stripe-connect";
import {
  notifyPaymentReleased,
  notifyPayoutClaimReady,
  notifyReviewRequestsForJob,
} from "@/lib/notifications";
import {
  finishJobSettlement,
  reserveJobSettlement,
  transferJobPayment,
} from "./job-transfers";

/** Called after caller authorization. The reservation rechecks job state under lock. */
export async function approveJobPayment(
  jobId: string,
  disputeId?: string,
): Promise<"released" | "manual" | "pending_onboarding"> {
  const db = createServiceClient();
  const payment = await getTransactionByJob(jobId);
  if (!payment || payment.status !== "held")
    throw new Error("No held payment found");
  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("id,title,kinglancer_id")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  if (!job?.kinglancer_id) throw new Error("No Kinglancer assigned");
  const { data: worker, error } = await db
    .from("profiles")
    .select("email,full_name,stripe_account_id,stripe_onboarding_complete")
    .eq("id", job.kinglancer_id)
    .single();
  if (error) throw error;
  if (!worker?.email) throw new Error("Kinglancer contact is missing");
  const workerStripePayout = await hasEntitlement(
    job.kinglancer_id,
    "kinglancer",
    "stripePayout",
  );
  if (
    shouldPayoutManually({
      paymentMethod: payment.payment_method,
      workerStripePayout,
    })
  ) {
    const reservation = await reserveJobSettlement(
      payment.id,
      "queue_manual",
      disputeId,
    );
    await finishJobSettlement(payment.id, reservation.release_attempt_id);
    return "manual";
  }
  const net = payment.amount - payment.platform_fee_kinglancer;
  if (worker.stripe_onboarding_complete && worker.stripe_account_id) {
    await transferJobPayment({
      transactionId: payment.id,
      jobId,
      amountPence: Math.round(net * 100),
      destinationAccountId: worker.stripe_account_id,
      disputeId,
    });
    void notifyPaymentReleased({
      kinglancerId: job.kinglancer_id,
      kinglancerEmail: worker.email,
      jobTitle: job.title,
      amount: net,
    }).catch(console.error);
    void notifyReviewRequestsForJob(jobId, job.title).catch(console.error);
    return "released";
  }
  const accountId = await getOrCreateStripeAccount(
    job.kinglancer_id,
    worker.email,
    worker.stripe_account_id,
    worker.full_name ?? undefined,
  );
  const onboardingUrl = await createOnboardingLink(accountId);
  const reservation = await reserveJobSettlement(
    payment.id,
    "queue_stripe",
    disputeId,
  );
  await finishJobSettlement(payment.id, reservation.release_attempt_id);
  void notifyPayoutClaimReady({
    kinglancerId: job.kinglancer_id,
    kinglancerEmail: worker.email,
    jobTitle: job.title,
    amount: net,
    onboardingUrl,
  }).catch(console.error);
  return "pending_onboarding";
}
