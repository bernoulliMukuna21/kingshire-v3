// Shared "select an applicant → pending offer → accept/decline" semantics
// used by BOTH organisation role jobs (engagements) and placements
// (placement_agreements). Selecting an applicant is an offer, not a hire —
// the Kinglancer must accept before anything starts or money moves. Keeping
// these rules in one place stops the two hiring flows drifting apart.

/**
 * Application status meaning "the org selected them; waiting on their
 * decision." Deliberately distinct from 'pending' (never reviewed) so
 * "needs your review" counts don't re-surface an applicant the org already
 * acted on.
 */
export const OFFERED_STATUS = "offered" as const;

/** What an engagement/agreement becomes once the worker accepts an offer. */
export function nextStatusOnOfferAccepted(
  isManaged: boolean,
): "pending_funding" | "active" {
  return isManaged ? "pending_funding" : "active";
}
