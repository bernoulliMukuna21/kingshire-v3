import { getRecoverablePayments } from "@/lib/db/engagement-payments";
import { chargeEngagementPayment, reconcileEngagementPayment } from "./billing";
import { resumeEngagementCheckout } from "./checkout";

/** Cursor batches bound memory and isolate failures. Paid rows stay eligible
 * until every fulfilment effect succeeds; uncertain attempts remain reserved. */
export async function recoverEngagementPayments(): Promise<{
  checked: number;
  errors: string[];
}> {
  let afterId: string | undefined;
  let checked = 0;
  const errors: string[] = [];
  for (;;) {
    const payments = await getRecoverablePayments(afterId);
    for (const payment of payments) {
      checked++;
      try {
        if (
          payment.attempt_kind === "checkout" &&
          payment.status === "processing"
        ) {
          await resumeEngagementCheckout(payment);
        } else if (
          payment.stripe_payment_intent_id &&
          ["held", "released", "failed"].includes(payment.status)
        ) {
          await reconcileEngagementPayment(
            payment.id,
            payment.stripe_payment_intent_id,
          );
        } else if (
          payment.status === "processing" &&
          payment.attempt_kind === "automatic"
        ) {
          const result = await chargeEngagementPayment(payment.id);
          if (result === "reconciliation_pending")
            errors.push(
              `${payment.id}: Stripe reconciliation is still pending`,
            );
        } else if (payment.status === "processing") {
          // Legacy Checkout/charge attempts have no reliable kind or Stripe
          // identifier. Never reset them and risk collecting a second payment.
          if (payment.stripe_payment_intent_id)
            await reconcileEngagementPayment(
              payment.id,
              payment.stripe_payment_intent_id,
            );
          else
            errors.push(
              `${payment.id}: legacy attempt requires reconciliation`,
            );
        }
      } catch (error) {
        errors.push(
          `${payment.id}: ${error instanceof Error ? error.message : "Recovery failed"}`,
        );
      }
    }
    if (payments.length < 100) break;
    afterId = payments[payments.length - 1].id;
  }
  return { checked, errors };
}
