import { getOrganisationStripePaymentContext } from "@/lib/settlement/billing";
import { chargeEngagementPayment } from "@/lib/settlement/billing";
import { fulfillPlacementPayment } from "@/lib/placement-payouts";
import type { PlacementPaymentRow } from "@/lib/db/placement-payments";

export type ChargeResult = "charged" | "failed" | "no_payment_method";

// Placement compatibility export; card resolution now lives in the shared engine.
export const getOrgPaymentContext = getOrganisationStripePaymentContext;

/** Placement billing delegates to the domain-agnostic settlement engine. */
export async function chargeDuePlacementPayment(
  payment: PlacementPaymentRow,
): Promise<ChargeResult> {
  const result = await chargeEngagementPayment(payment.id);
  if (result === "charged") {
    await fulfillPlacementPayment(payment.id, null);
    return "charged";
  }
  if (result === "no_payment_method") return "no_payment_method";
  return "failed";
}
