import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagement } from "@/lib/db/engagements";
import {
  getEngagementPayment,
  reserveEngagementPayment,
  updateEngagementPaymentStatus,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
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

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
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
    return Number(payment.platform_fee_client) +
      Number(payment.platform_fee_kinglancer);
  }
  return Number(payment.worker_amount) + Number(payment.platform_fee_client);
}

export type EngagementChargeResult =
  | "charged"
  | "already_processed"
  | "no_payment_method"
  | "failed"
  | "not_chargeable";

/** Charge one period and move it into escrow, or settle a direct fee period. */
export async function chargeEngagementPayment(
  paymentId: string,
): Promise<EngagementChargeResult> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment) return "not_chargeable";
  if (payment.status !== "due") return "already_processed";

  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || engagement.status === "cancelled" || engagement.status === "ended") {
    return "not_chargeable";
  }

  const context = await getOrganisationStripePaymentContext(
    payment.organisation_id,
  );
  if (!context) return "no_payment_method";

  const amountGBP = chargeAmountGBP(payment, engagement.settlement_mode);
  if (amountGBP <= 0) return "not_chargeable";

  const reserved = await reserveEngagementPayment(payment.id);
  if (!reserved) return "already_processed";

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amountGBP * 100),
        currency: "gbp",
        customer: context.customerId,
        payment_method: context.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          purpose: "engagement_payment",
          engagement_payment_id: payment.id,
          engagement_id: payment.engagement_id,
        },
      },
      { idempotencyKey: `engagement-charge-${payment.id}` },
    );

    if (intent.status !== "succeeded") {
      await updateEngagementPaymentStatus(payment.id, "failed", {
        stripe_payment_intent_id: intent.id,
      });
      return "failed";
    }

    const now = new Date().toISOString();
    if (engagement.settlement_mode === "direct") {
      await updateEngagementPaymentStatus(payment.id, "released", {
        stripe_payment_intent_id: intent.id,
        charged_at: now,
        released_at: now,
      });
    } else {
      await updateEngagementPaymentStatus(payment.id, "held", {
        stripe_payment_intent_id: intent.id,
        charged_at: now,
      });
    }
    return "charged";
  } catch (error) {
    await updateEngagementPaymentStatus(payment.id, "failed");
    console.error(
      `[settlement] charge failed for payment ${payment.id}:`,
      error instanceof Error ? error.message : error,
    );
    return "failed";
  }
}
