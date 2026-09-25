import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagement } from "@/lib/db/engagements";
import {
  getEngagementPayment,
  reserveEngagementPayment,
  patchPaymentAttempt,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import { fulfilEngagementPayment } from "./fulfilment";
import type { SettlementMode } from "./types";

export type OrganisationStripePaymentContext = {
  customerId: string;
  paymentMethodId: string;
};

/** Resolve the organisation's saved card, including the subscription default. */
export async function getOrganisationStripePaymentContext(
  organisationId: string,
): Promise<OrganisationStripePaymentContext | null> {
  const db = createServiceClient();
  const { data: subscription } = await db
    .from("organisation_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  const customerId = subscription?.stripe_customer_id;
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return null;

  const defaultPaymentMethod =
    customer.invoice_settings?.default_payment_method;
  let paymentMethodId =
    typeof defaultPaymentMethod === "string"
      ? defaultPaymentMethod
      : (defaultPaymentMethod?.id ?? null);

  if (!paymentMethodId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 3,
    });
    const subscriptionWithPaymentMethod =
      subscriptions.data.find((item) =>
        ["active", "trialing", "past_due"].includes(item.status),
      ) ?? subscriptions.data[0];
    const subscriptionPaymentMethod =
      subscriptionWithPaymentMethod?.default_payment_method;
    paymentMethodId =
      typeof subscriptionPaymentMethod === "string"
        ? subscriptionPaymentMethod
        : (subscriptionPaymentMethod?.id ?? null);
  }

  if (!paymentMethodId) {
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    paymentMethodId = cards.data[0]?.id ?? null;
  }

  return paymentMethodId ? { customerId, paymentMethodId } : null;
}

function chargeAmountGBP(
  payment: EngagementPaymentRow,
  mode: SettlementMode,
): number {
  if (mode === "direct") {
    return (
      Number(payment.platform_fee_client) +
      Number(payment.platform_fee_kinglancer)
    );
  }
  return Number(payment.worker_amount) + Number(payment.platform_fee_client);
}

export type EngagementChargeResult =
  | "charged"
  | "reconciliation_pending"
  | "already_processed"
  | "no_payment_method"
  | "failed"
  | "not_chargeable";

// A lost response must never be retried after Stripe may have discarded its
// idempotency key. Older unidentified attempts require operator reconciliation.
export function canRecoverCreation(startedAt: string | null): boolean {
  return (
    !!startedAt &&
    Date.now() - new Date(startedAt).getTime() < 20 * 60 * 60 * 1000
  );
}

export async function reconcileEngagementPayment(
  paymentId: string,
  intentId: string,
): Promise<void> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment) throw new Error("Payment not found");
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement) throw new Error("Engagement not found");
  const intent = await stripe.paymentIntents.retrieve(intentId);
  const sourcePaymentId =
    intent.metadata.engagement_payment_id ??
    intent.metadata.placement_payment_id;
  if (
    sourcePaymentId !== paymentId ||
    intent.currency !== "gbp" ||
    intent.amount !==
      Math.round(chargeAmountGBP(payment, engagement.settlement_mode) * 100)
  ) {
    throw new Error("Stripe payment does not match the ledger");
  }
  if (intent.status !== "succeeded") return;
  await fulfilEngagementPayment(paymentId, intent.id);
}

// A failure event is not a terminal attempt: Checkout may still be payable,
// and an automatic PaymentIntent may be confirmed again with a replacement card.
export async function reconcileFailedEngagementPayment(
  paymentId: string,
  intentId: string,
): Promise<void> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment || payment.status !== "processing") return;
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (
    (intent.metadata.engagement_payment_id ??
      intent.metadata.placement_payment_id) !== paymentId
  ) {
    throw new Error("PaymentIntent belongs to another payment");
  }
  if (
    payment.stripe_payment_intent_id &&
    payment.stripe_payment_intent_id !== intentId
  )
    return;
  await patchPaymentAttempt(payment, { stripe_payment_intent_id: intentId });
  if (intent.status === "succeeded")
    await reconcileEngagementPayment(paymentId, intent.id);
}

async function resumeAutomaticPayment(
  payment: EngagementPaymentRow,
): Promise<EngagementChargeResult> {
  if (
    !payment.attempt_id ||
    !payment.attempt_customer_id ||
    !payment.attempt_payment_method_id
  ) {
    // Legacy or uncertain attempts cannot safely be charged again automatically.
    return "reconciliation_pending";
  }
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement) return "not_chargeable";
  let intent;
  if (payment.stripe_payment_intent_id) {
    intent = await stripe.paymentIntents.retrieve(
      payment.stripe_payment_intent_id,
    );
  } else {
    if (!canRecoverCreation(payment.attempt_started_at))
      return "reconciliation_pending";
    // Persist the ID BEFORE confirmation. A crash during creation leaves an
    // unconfirmed intent, which the same attempt key can safely retrieve.
    intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(
          chargeAmountGBP(payment, engagement.settlement_mode) * 100,
        ),
        currency: "gbp",
        customer: payment.attempt_customer_id,
        payment_method: payment.attempt_payment_method_id,
        metadata: {
          purpose: "engagement_payment",
          engagement_payment_id: payment.id,
          engagement_id: engagement.id,
        },
      },
      { idempotencyKey: `engagement-create-${payment.attempt_id}` },
    );
    await patchPaymentAttempt(payment, { stripe_payment_intent_id: intent.id });
  }
  if (intent.status === "succeeded") {
    await reconcileEngagementPayment(payment.id, intent.id);
    return "charged";
  }
  if (!["active", "pending_funding"].includes(engagement.status))
    return "not_chargeable";
  if (
    intent.status === "requires_confirmation" ||
    intent.status === "requires_payment_method"
  ) {
    const context = await getOrganisationStripePaymentContext(
      payment.organisation_id,
    );
    if (!context) return "no_payment_method";
    intent = await stripe.paymentIntents.confirm(intent.id, {
      payment_method: context.paymentMethodId,
      off_session: true,
    });
  }
  if (intent.status !== "succeeded") return "reconciliation_pending";
  await reconcileEngagementPayment(payment.id, intent.id);
  return "charged";
}

export async function chargeEngagementPayment(
  paymentId: string,
): Promise<EngagementChargeResult> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment) return "not_chargeable";
  if (payment.status === "processing") {
    return payment.attempt_kind === "automatic"
      ? resumeAutomaticPayment(payment)
      : "already_processed";
  }
  if (payment.status !== "due" && payment.status !== "failed")
    return "already_processed";
  if (payment.stripe_payment_intent_id) {
    await reconcileEngagementPayment(
      payment.id,
      payment.stripe_payment_intent_id,
    );
    return "reconciliation_pending";
  }
  // Legacy failed rows can represent a lost Stripe response. New attempts
  // remain processing until reconciled, so never create a fresh charge here.
  if (payment.status === "failed") return "reconciliation_pending";
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || !["active", "pending_funding"].includes(engagement.status))
    return "not_chargeable";
  // First placement funding is explicitly on-session. It cannot compete with
  // an organisation opening Checkout using its subscription's saved card.
  if (
    engagement.source_kind === "placement" &&
    engagement.status === "pending_funding"
  )
    return "not_chargeable";
  const context = await getOrganisationStripePaymentContext(
    payment.organisation_id,
  );
  if (!context) return "no_payment_method";
  const reserved = await reserveEngagementPayment(
    payment.id,
    "automatic",
    context,
  );
  if (!reserved) return "already_processed";
  return resumeAutomaticPayment(reserved);
}
