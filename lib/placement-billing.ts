import { getOrganisationStripePaymentContext } from "@/lib/settlement/billing";
import { chargeEngagementPayment } from "@/lib/settlement/billing";
import type { PlacementPaymentRow } from "@/lib/db/placement-payments";

export type ChargeResult =
  | "charged"
  | "failed"
  | "no_payment_method"
  | "reconciliation_pending"
  | "skipped";

// Placement compatibility export; card resolution now lives in the shared engine.
export const getOrgPaymentContext = getOrganisationStripePaymentContext;

/** Placement billing delegates to the domain-agnostic settlement engine. */
export async function chargeDuePlacementPayment(
  payment: PlacementPaymentRow,
): Promise<ChargeResult> {
  const result = await chargeEngagementPayment(payment.id);
  if (result === "charged") {
    return "charged";
  }
  if (result === "no_payment_method") return "no_payment_method";
  if (result === "reconciliation_pending") return result;
  if (result === "already_processed" || result === "not_chargeable")
    return "skipped";
  return "failed";
}
