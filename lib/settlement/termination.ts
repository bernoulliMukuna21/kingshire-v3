import {
  getEngagementPayments,
  updateEngagementPaymentStatus,
} from "@/lib/db/engagement-payments";

/**
 * Settles an engagement's payment ledger when it's ended early: future (due)
 * periods are cancelled; a period already held in escrow is sent to admin
 * (disputed) to release or refund. Domain-agnostic — used by both Placements
 * and Organisation roles.
 */
export async function settleEngagementPaymentsOnEarlyEnd(
  engagementId: string,
  reason: string,
): Promise<void> {
  const payments = await getEngagementPayments(engagementId);
  await Promise.all(
    payments.map((payment) =>
      payment.status === "due"
        ? updateEngagementPaymentStatus(payment.id, "cancelled")
        : payment.status === "held"
          ? updateEngagementPaymentStatus(payment.id, "disputed", {
              dispute_reason: reason,
            })
          : Promise.resolve(null),
    ),
  );
}
