import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  updatePlacementPaymentStatus,
  type PlacementPaymentRow,
} from "@/lib/db/placement-payments";
import { fulfillPlacementPayment } from "@/lib/placement-payouts";

export type ChargeResult = "charged" | "failed" | "no_payment_method";

/** The org's Stripe customer + a usable saved card, or null if none on file. */
export async function getOrgPaymentContext(
  organisationId: string,
): Promise<{ customerId: string; paymentMethodId: string } | null> {
  const db = createServiceClient();
  const { data: sub } = await db
    .from("organisation_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  const customerId = sub?.stripe_customer_id;
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return null;

  const defaultPm = customer.invoice_settings?.default_payment_method;
  let paymentMethodId =
    typeof defaultPm === "string" ? defaultPm : (defaultPm?.id ?? null);

  // Checkout attaches the subscription card as the *subscription's* default
  // payment method, not always the customer's invoice_settings default, so
  // check the live subscription before giving up.
  if (!paymentMethodId) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 3,
    });
    const usable =
      subs.data.find((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      ) ?? subs.data[0];
    const subPm = usable?.default_payment_method;
    paymentMethodId =
      typeof subPm === "string" ? subPm : (subPm?.id ?? null);
  }

  if (!paymentMethodId) {
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    paymentMethodId = cards.data[0]?.id ?? null;
  }
  if (!paymentMethodId) return null;
  return { customerId, paymentMethodId };
}

/**
 * Charges a single due placement payment off-session against the org's saved
 * card. On success the payment is fulfilled (held → transfer to the
 * Kinglancer). On decline / authentication-required it is marked `failed` so
 * the org can retry. Idempotent per payment via the Stripe idempotency key.
 */
export async function chargeDuePlacementPayment(
  payment: PlacementPaymentRow,
): Promise<ChargeResult> {
  const ctx = await getOrgPaymentContext(payment.organisation_id);
  if (!ctx) return "no_payment_method";

  const amountPence = Math.round(
    (Number(payment.amount) + Number(payment.platform_fee_client)) * 100,
  );

  // Reserve the row before charging so an overlapping run can't double-charge.
  await updatePlacementPaymentStatus(payment.id, { status: "processing" });

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: amountPence,
        currency: "gbp",
        customer: ctx.customerId,
        payment_method: ctx.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          purpose: "placement_payment",
          placement_payment_id: payment.id,
          agreement_id: payment.agreement_id,
        },
      },
      { idempotencyKey: `placement-charge-${payment.id}` },
    );

    if (intent.status === "succeeded") {
      await fulfillPlacementPayment(payment.id, intent.id);
      return "charged";
    }

    // requires_action (SCA), requires_payment_method, etc. — needs the org.
    await updatePlacementPaymentStatus(payment.id, {
      status: "failed",
      stripe_payment_intent_id: intent.id,
    });
    return "failed";
  } catch (err) {
    await updatePlacementPaymentStatus(payment.id, { status: "failed" });
    console.error(
      `[placement-billing] charge failed for payment ${payment.id}:`,
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}
