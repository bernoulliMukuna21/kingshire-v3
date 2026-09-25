import { reconcileEngagementPayment } from "@/lib/settlement/billing";
import {
  releaseEngagementPayment,
  processEngagementReleases,
} from "@/lib/settlement/payouts";
import { periodEnd } from "@/lib/settlement/schedule";
import type { PlacementPaymentRow } from "@/lib/db/placement-payments";

export const RELEASE_NOTICE_DAYS = 7;

export function placementPeriodEnd(dueDate: string): Date {
  return periodEnd(new Date(`${dueDate}T00:00:00.000Z`), "monthly");
}

/** Placement-specific lifecycle hook for the on-session Checkout flow (see
 * .../payments/[paymentId]/checkout/route.ts) — records the charge on the
 * shared ledger, then activates the agreement if this funded its first month. */
export async function fulfillPlacementPayment(
  paymentId: string,
  paymentIntentId: string | null,
): Promise<void> {
  if (!paymentIntentId)
    throw new Error("PaymentIntent is required to confirm funding");
  await reconcileEngagementPayment(paymentId, paymentIntentId);
}

export type PlacementPayoutResult =
  | "released"
  | "pending_onboarding"
  | "skipped"
  | "already_transferred";

export async function firePlacementPayout(
  payment: PlacementPaymentRow,
): Promise<PlacementPayoutResult> {
  const result = await releaseEngagementPayment(payment.id);
  if (result === "not_eligible") return "skipped";
  return result;
}

export async function firePendingPlacementPayouts(
  kinglancerId: string,
): Promise<void> {
  void kinglancerId;
  await processEngagementReleases();
}

export async function processPlacementReleases(): Promise<{
  released: number;
  noticed: number;
}> {
  const result = await processEngagementReleases();
  return { released: result.released, noticed: result.noticed };
}
