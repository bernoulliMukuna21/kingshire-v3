import {
  getEngagementPayments,
  cancelUnchargedEngagementPayment,
  updateEngagementPaymentStatusIf,
} from "@/lib/db/engagement-payments";

/** Cancels any not-yet-charged period (due, or failed and due for retry) so
 * it's never billed again — safe for both early-end and normal completion,
 * since these periods haven't taken anyone's money yet. */
export async function cancelRemainingEngagementPayments(
  engagementId: string,
): Promise<void> {
  const payments = await getEngagementPayments(engagementId);
  await Promise.all(
    payments
      .filter((p) => p.status === "due" || p.status === "failed")
      .map((p) => cancelUnchargedEngagementPayment(p.id)),
  );
}

/**
 * Settles an engagement's payment ledger when it's ended early: future (due)
 * periods, and any failed attempt that would otherwise be retried, are
 * cancelled; a period already held in escrow is sent to admin (disputed) to
 * release or refund — early-end may leave a period only partially earned,
 * so it must not just auto-release like a normal completion would. Domain-
 * agnostic — used by both Placements and Organisation roles.
 */
export async function settleEngagementPaymentsOnEarlyEnd(
  engagementId: string,
  reason: string,
): Promise<void> {
  await cancelRemainingEngagementPayments(engagementId);
  const payments = await getEngagementPayments(engagementId);
  await Promise.all(
    payments.map((payment) => {
      if (payment.status === "held") {
        // CAS: don't stomp a concurrent release/refund that already moved
        // this period out of "held", or interrupt one that has already
        // reserved this row and is mid-transfer.
        return updateEngagementPaymentStatusIf(
          payment.id,
          ["held"],
          "disputed",
          { dispute_reason: reason },
          { requireReleaseAttemptId: null },
        );
      }
      // "processing": a charge may already be in flight with Stripe — forcing
      // a status here would race the webhook/cron that completes it.
      // fulfilEngagementPayment routes a late success straight to "disputed"
      // once it sees the engagement has ended, so it's never silently held.
      return Promise.resolve(null);
    }),
  );
}
