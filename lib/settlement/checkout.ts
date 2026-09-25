import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagement } from "@/lib/db/engagements";
import {
  getEngagementPayment,
  patchPaymentAttempt,
  reserveEngagementPayment,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import { canRecoverCreation, reconcileEngagementPayment } from "./billing";

/** Resume the SAME Checkout attempt. A processing row is never an invitation
 * to create another session, nor can the charge cron reset it on a timer. */
export async function resumeEngagementCheckout(
  payment: EngagementPaymentRow,
): Promise<string | null> {
  if (payment.attempt_kind !== "checkout" || !payment.attempt_id) return null;
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || engagement.source_kind !== "placement") return null;
  let session;
  if (payment.checkout_session_id) {
    session = await stripe.checkout.sessions.retrieve(
      payment.checkout_session_id,
    );
  } else {
    if (!canRecoverCreation(payment.attempt_started_at))
      throw new Error(
        "Checkout needs reconciliation before another payment can be started.",
      );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("Application URL is missing");
    const metadata = {
      purpose: "placement_payment",
      placement_payment_id: payment.id,
    };
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: Math.round(
                (Number(payment.worker_amount) +
                  Number(payment.platform_fee_client)) *
                  100,
              ),
              product_data: {
                name: `Placement payment — month ${payment.period_index}`,
              },
            },
          },
        ],
        payment_intent_data: { metadata },
        metadata,
        success_url: `${appUrl}/dashboard/placements/agreements/${engagement.source_id}?paid=1`,
        cancel_url: `${appUrl}/dashboard/placements/agreements/${engagement.source_id}?cancelled=1`,
      },
      { idempotencyKey: `engagement-checkout-${payment.attempt_id}` },
    );
    await patchPaymentAttempt(payment, { checkout_session_id: session.id });
  }
  if (session.payment_status === "paid") {
    const id =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!id) throw new Error("Paid checkout has no PaymentIntent");
    await reconcileEngagementPayment(payment.id, id);
    return null;
  }
  if (session.status === "expired") {
    // Only a confirmed expired session can relinquish its reservation.
    const { error } = await createServiceClient()
      .from("engagement_payments")
      .update({
        status: "due",
        attempt_id: null,
        attempt_kind: null,
        attempt_started_at: null,
        checkout_session_id: null,
        stripe_payment_intent_id: null,
      })
      .eq("id", payment.id)
      .eq("attempt_id", payment.attempt_id)
      .eq("status", "processing");
    if (error) throw error;
    return null;
  }
  return session.status === "open" ? session.url : null;
}

export async function startEngagementCheckout(
  paymentId: string,
): Promise<string | null> {
  let payment = await getEngagementPayment(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "due" || payment.status === "failed") {
    payment =
      (await reserveEngagementPayment(paymentId, "checkout")) ??
      (await getEngagementPayment(paymentId));
  }
  if (
    !payment ||
    payment.status !== "processing" ||
    payment.attempt_kind !== "checkout"
  )
    return null;
  return resumeEngagementCheckout(payment);
}
