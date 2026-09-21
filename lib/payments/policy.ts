import { isSubscribed } from "@/lib/subscriptions";

// A job is "small" below this budget (£). Small jobs are the ones Stripe's
// per-transaction cost bites on, so they're gated behind subscriptions on both
// sides: a non-subscribed client can't pay them by card (bank transfer only),
// and a non-subscribed kinglancer can't apply to them. Org jobs are exempt on
// the card side (the organisation already carries a subscription).
export const SMALL_JOB_THRESHOLD_GBP = 25;

export type JobPaymentPolicy = {
  // May the payer choose card at all?
  cardAllowed: boolean;
  // Card is blocked purely because it's a small personal job — a subscription
  // (or a bank transfer) would unlock it.
  requiresSubscription: boolean;
  // Bank transfer is always available.
  bankTransferAllowed: boolean;
};

// Pure decision — no I/O, easy to unit test.
export function resolveCardPolicy(input: {
  organisationId: string | null;
  budget: number;
  clientSubscribed: boolean;
}): JobPaymentPolicy {
  // Org jobs ride the organisation subscription — card always available.
  if (input.organisationId) {
    return {
      cardAllowed: true,
      requiresSubscription: false,
      bankTransferAllowed: true,
    };
  }
  const belowThreshold = input.budget < SMALL_JOB_THRESHOLD_GBP;
  const cardAllowed = input.clientSubscribed || !belowThreshold;
  return {
    cardAllowed,
    requiresSubscription: belowThreshold && !input.clientSubscribed,
    bankTransferAllowed: true,
  };
}

// Resolves the policy for a concrete job, fetching the client's subscription
// only when it matters (personal jobs).
export async function getJobPaymentPolicy(job: {
  organisation_id: string | null;
  client_id: string;
  budget: number;
}): Promise<JobPaymentPolicy> {
  const clientSubscribed = job.organisation_id
    ? true
    : await isSubscribed(job.client_id, "client");
  return resolveCardPolicy({
    organisationId: job.organisation_id,
    budget: job.budget,
    clientSubscribed,
  });
}

// Whether applying to a job requires a kinglancer subscription (small jobs are
// subscriber-only to apply to). Budget in £.
export function jobRequiresSubscriptionToApply(budget: number): boolean {
  return budget < SMALL_JOB_THRESHOLD_GBP;
}

// Payout rail: pay the worker manually (payout link) UNLESS the job was
// card-funded AND the worker holds a Stripe-payout subscription. This keeps
// unsubscribed workers off Stripe Connect entirely — no active-account fee
// (£2/month) is ever incurred for them. Bank-transfer jobs are always manual
// (there is no Stripe balance to transfer from).
export function shouldPayoutManually(input: {
  paymentMethod: string | null;
  workerStripePayout: boolean;
}): boolean {
  return input.paymentMethod === "bank_transfer" || !input.workerStripePayout;
}
