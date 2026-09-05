import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { CLIENT_SUBSCRIPTION_PRICE_GBP } from "@/lib/client-subscription";
import {
  getClientSubscriptionRow,
  upsertClientSubscription,
  updateClientSubscriptionBySubscriptionId,
} from "@/lib/db/client-subscriptions";

export const CLIENT_SUBSCRIPTION_PURPOSE = "client_subscription";

export class ClientSubscriptionError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "already_active"
      | "not_found"
      | "conflict"
      | "stripe_error",
    message: string,
  ) {
    super(message);
    this.name = "ClientSubscriptionError";
  }
}

function getPriceId(): string {
  const priceId = process.env.STRIPE_CLIENT_SUBSCRIPTION_PRICE_ID?.trim();
  if (!priceId) {
    throw new ClientSubscriptionError(
      "not_configured",
      "Client subscription billing is not configured.",
    );
  }
  return priceId;
}

function publicAppUrl(requestUrl: string) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.APP_URL?.replace(/\/$/, "") ??
    new URL(requestUrl).origin
  );
}

function getExpandedId(
  value: string | { id: string } | null,
  label: string,
): string {
  const id = typeof value === "string" ? value : value?.id;
  if (!id) {
    throw new ClientSubscriptionError(
      "stripe_error",
      `Stripe ${label} is missing.`,
    );
  }
  return id;
}

/**
 * Starts a £10/month Stripe Checkout subscription for a Client. Reuses the
 * existing Stripe customer when the Client has subscribed before. Throws
 * `already_active` when they already hold a live subscription.
 */
export async function createClientSubscriptionCheckout(input: {
  userId: string;
  userEmail: string;
  requestUrl: string;
}): Promise<{ url: string }> {
  const priceId = getPriceId();
  const price = await stripe.prices.retrieve(priceId);
  if (
    !price.active ||
    price.currency.toLowerCase() !== "gbp" ||
    price.unit_amount !== CLIENT_SUBSCRIPTION_PRICE_GBP * 100 ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  ) {
    throw new ClientSubscriptionError(
      "not_configured",
      `Client subscription is not configured as a £${CLIENT_SUBSCRIPTION_PRICE_GBP} monthly Stripe price.`,
    );
  }

  const existing = await getClientSubscriptionRow(input.userId);
  if (
    existing &&
    (existing.status === "active" || existing.status === "trialing")
  ) {
    throw new ClientSubscriptionError(
      "already_active",
      "You already have an active subscription.",
    );
  }

  const appUrl = publicAppUrl(input.requestUrl);
  const metadata = {
    purpose: CLIENT_SUBSCRIPTION_PURPOSE,
    user_id: input.userId,
  };

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: input.userEmail }),
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: input.userId,
      metadata,
      subscription_data: { metadata },
      success_url: `${appUrl}/dashboard/client/subscription?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/client/subscription?cancelled=1`,
    },
    { idempotencyKey: `client-subscription-${input.userId}` },
  );

  if (!session.url) {
    throw new ClientSubscriptionError(
      "stripe_error",
      "Stripe did not provide a checkout URL.",
    );
  }
  return { url: session.url };
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

/**
 * Confirms a completed Checkout session and records the subscription. Idempotent
 * — safe to call from both the return page and the webhook.
 */
export async function fulfillClientSubscriptionCheckout(
  checkoutSessionId: string,
  expectedUserId?: string,
): Promise<{ userId: string }> {
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "customer"],
  });

  if (
    session.metadata?.purpose !== CLIENT_SUBSCRIPTION_PURPOSE ||
    !session.metadata.user_id
  ) {
    throw new ClientSubscriptionError(
      "not_found",
      "Client subscription checkout was not found.",
    );
  }
  const userId = session.metadata.user_id;
  if (expectedUserId && userId !== expectedUserId) {
    throw new ClientSubscriptionError(
      "conflict",
      "This checkout belongs to another account.",
    );
  }
  if (session.status !== "complete" || session.payment_status === "unpaid") {
    throw new ClientSubscriptionError(
      "conflict",
      "The subscription payment has not completed.",
    );
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  if (!subscription) {
    throw new ClientSubscriptionError(
      "conflict",
      "The subscription is not ready yet.",
    );
  }

  await upsertClientSubscription({
    user_id: userId,
    status: subscription.status,
    stripe_customer_id: getExpandedId(session.customer, "customer"),
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id ?? "",
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: subscriptionPeriodEnd(subscription),
  });

  return { userId };
}

/** Keeps our copy of the subscription in step with Stripe lifecycle events. */
export async function syncClientSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  await updateClientSubscriptionBySubscriptionId(subscription.id, {
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_price_id: subscription.items.data[0]?.price.id ?? undefined,
    current_period_end: subscriptionPeriodEnd(subscription) ?? undefined,
  });
}

/** Opens the Stripe billing portal so a Client can manage or cancel. */
export async function createClientBillingPortalSession(input: {
  userId: string;
  requestUrl: string;
}): Promise<{ url: string }> {
  const existing = await getClientSubscriptionRow(input.userId);
  if (!existing?.stripe_customer_id) {
    throw new ClientSubscriptionError(
      "not_found",
      "No subscription was found for this account.",
    );
  }
  const appUrl = publicAppUrl(input.requestUrl);
  const portal = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: `${appUrl}/dashboard/client/subscription`,
  });
  return { url: portal.url };
}
