import { getEngagementBySource } from "@/lib/db/engagements";
import { getEngagementPayment } from "@/lib/db/engagement-payments";
import { releaseEngagementPayment, processEngagementReleases } from "@/lib/settlement/payouts";
import { periodEnd } from "@/lib/settlement/schedule";
import { activateAgreement } from "@/lib/db/placements";
import type { PlacementPaymentRow } from "@/lib/db/placement-payments";

export const RELEASE_NOTICE_DAYS = 7;

export function placementPeriodEnd(dueDate: string): Date {
  return periodEnd(new Date(`${dueDate}T00:00:00.000Z`), "monthly");
}

/** Placement-specific lifecycle hook; escrow state is owned by the shared ledger. */
export async function fulfillPlacementPayment(
  paymentId: string,
  paymentIntentId: string | null,
): Promise<void> {
  void paymentIntentId;
  const payment = await getEngagementPayment(paymentId);
  if (!payment) return;
  if (payment.period_index === 1) {
    const engagement = await getEngagementBySource("placement", payment.engagement_id);
    if (engagement) await activateAgreement(engagement.source_id).catch(() => {});
  }
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
