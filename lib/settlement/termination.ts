import {
  getEngagementPayments,
  updateEngagementPaymentStatus,
  updateEngagementPaymentStatusIf,
} from "@/lib/db/engagement-payments";

/**
 * Settles an engagement's payment ledger when it's ended early: future (due)
 * periods, and any failed attempt that would otherwise be retried, are
 * cancelled; a period already held in escrow is sent to admin (disputed) to
 * release or refund. Domain-agnostic — used by both Placements and
 * Organisation roles.
 */
export async function settleEngagementPaymentsOnEarlyEnd(
  engagementId: string,
  reason: string,
): Promise<void> {
  const payments = await getEngagementPayments(engagementId);
  await Promise.all(
    payments.map((payment) => {
      if (payment.status === "due" || payment.status === "failed") {
        return updateEngagementPaymentStatus(payment.id, "cancelled");
      }
      if (payment.status === "held") {
        // CAS: don't stomp a concurrent release/refund that already moved
        // this period out of "held".
        return updateEngagementPaymentStatusIf(payment.id, ["held"], "disputed", {
          dispute_reason: reason,
        });
      }
      // "processing": a charge may already be in flight with Stripe — forcing
      // a status here would race the webhook/cron that completes it.
      // fulfilEngagementPayment routes a late success straight to "disputed"
      // once it sees the engagement has ended, so it's never silently held.
      return Promise.resolve(null);
    }),
  );
}
