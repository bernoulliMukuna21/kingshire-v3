import { isSubscribed } from "@/lib/subscriptions";

// Minimum job budget (£) a non-subscribed personal client may pay by card.
// Below this, Stripe's per-transaction cost isn't worth it on a low-value job,
// so card is reserved for subscribers; everyone else uses bank transfer.
// Org jobs are exempt (the organisation already carries a subscription).
export const CARD_MIN_WITHOUT_SUB_GBP = 25;

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
  const belowThreshold = input.budget < CARD_MIN_WITHOUT_SUB_GBP;
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
