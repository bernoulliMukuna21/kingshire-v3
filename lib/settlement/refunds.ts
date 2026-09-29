import { dispatchSettlement } from "./dispatch";
import {
  getEngagementPayment,
  reserveEngagementRelease,
  updateEngagementPaymentStatusIf,
  recordSettlementError,
} from "@/lib/db/engagement-payments";

export async function refundEngagementPayment(
  paymentId: string,
): Promise<"refunded" | "not_eligible"> {
  const payment = await getEngagementPayment(paymentId);
  if (
    !payment ||
    payment.status !== "disputed" ||
    payment.stripe_transfer_id ||
    !payment.stripe_payment_intent_id
  ) {
    return "not_eligible";
  }
  const reservation = await reserveEngagementRelease(
    paymentId,
    ["disputed"],
    "refund",
  );
  if (!reservation) return "not_eligible";
  try {
    await dispatchSettlement(
      "engagement_payments",
      payment.id,
      reservation.attemptId,
      {
        kind: "refund",
        params: {
          payment_intent: payment.stripe_payment_intent_id,
          metadata: { engagement_payment_id: payment.id },
        },
      },
    );
    const settled = await updateEngagementPaymentStatusIf(
      paymentId,
      ["disputed"],
      "refunded",
      { release_outcome: "succeeded" },
      { requireReleaseAttemptId: reservation.attemptId },
    );
    if (!settled)
      throw new Error("Refund finalisation requires reconciliation");
    return "refunded";
  } catch (error) {
    await recordSettlementError(paymentId, reservation.attemptId);
    throw error;
  }
}
