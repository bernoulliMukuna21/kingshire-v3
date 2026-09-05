import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  planForRole,
  type SubscriptionRole,
  type SubscriptionPlan,
} from "@/lib/subscriptions/plans";
import {
  getUserSubscriptionRow,
  upsertUserSubscription,
  updateUserSubscriptionBySubscriptionId,
} from "@/lib/db/user-subscriptions";

export const USER_SUBSCRIPTION_PURPOSE = "user_subscription";

export class UserSubscriptionError extends Error {
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
    this.name = "UserSubscriptionError";
  }
}

function getPriceId(plan: SubscriptionPlan): string {
  const priceId = process.env[plan.priceEnv]?.trim();
  if (!priceId) {
    throw new UserSubscriptionError(
      "not_configured",
      `${plan.name} subscription billing is not configured.`,
    );
  }
  return priceId;
}

function subscriptionReturnPath(role: SubscriptionRole): string {
  return role === "kinglancer"
    ? "/dashboard/kinglancer/subscription"
    : "/dashboard/client/subscription";
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
    throw new UserSubscriptionError(
      "stripe_error",
      `Stripe ${label} is missing.`,
    );
  }
  return id;
}

/**
 * Starts a Stripe Checkout subscription for a user in the given role. Reuses
 * their Stripe customer if they've subscribed before. Throws `already_active`
 * when a live subscription already exists.
 */
export async function createUserSubscriptionCheckout(input: {
  userId: string;
  userEmail: string;
  role: SubscriptionRole;
  requestUrl: string;
}): Promise<{ url: string }> {
  const plan = planForRole(input.role);
  const priceId = getPriceId(plan);
  const price = await stripe.prices.retrieve(priceId);
  if (
    !price.active ||
    price.currency.toLowerCase() !== "gbp" ||
    price.unit_amount !== plan.priceGBP * 100 ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  ) {
    throw new UserSubscriptionError(
      "not_configured",
      `${plan.name} subscription is not configured as a £${plan.priceGBP} monthly Stripe price.`,
    );
  }

  const existing = await getUserSubscriptionRow(input.userId);
  if (
    existing &&
    (existing.status === "active" || existing.status === "trialing")
  ) {
    throw new UserSubscriptionError(
      "already_active",
      "You already have an active subscription.",
    );
  }

  const appUrl = publicAppUrl(input.requestUrl);
  const metadata = {
    purpose: USER_SUBSCRIPTION_PURPOSE,
    user_id: input.userId,
    role: input.role,
    plan: plan.id,
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
      success_url: `${appUrl}${subscriptionReturnPath(input.role)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}${subscriptionReturnPath(input.role)}?cancelled=1`,
    },
    { idempotencyKey: `user-subscription-${input.userId}` },
  );

  if (!session.url) {
    throw new UserSubscriptionError(
      "stripe_error",
      "Stripe did not provide a checkout URL.",
    );
  }
  return { url: session.url };
}

function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

/**
 * Confirms a completed Checkout session and records the subscription. Idempotent
 * — safe to call from both the return page and the webhook.
 */
export async function fulfillUserSubscriptionCheckout(
  checkoutSessionId: string,
  expectedUserId?: string,
): Promise<{ userId: string }> {
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "customer"],
  });

  const role = session.metadata?.role;
  if (
    session.metadata?.purpose !== USER_SUBSCRIPTION_PURPOSE ||
    !session.metadata.user_id ||
    (role !== "client" && role !== "kinglancer")
  ) {
    throw new UserSubscriptionError(
      "not_found",
      "Subscription checkout was not found.",
    );
  }
  const userId = session.metadata.user_id;
  if (expectedUserId && userId !== expectedUserId) {
    throw new UserSubscriptionError(
      "conflict",
      "This checkout belongs to another account.",
    );
  }
  if (session.status !== "complete" || session.payment_status === "unpaid") {
    throw new UserSubscriptionError(
      "conflict",
      "The subscription payment has not completed.",
    );
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  if (!subscription) {
    throw new UserSubscriptionError(
      "conflict",
      "The subscription is not ready yet.",
    );
  }

  await upsertUserSubscription({
    user_id: userId,
    role,
    plan: session.metadata.plan ?? planForRole(role).id,
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
export async function syncUserSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  await updateUserSubscriptionBySubscriptionId(subscription.id, {
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_price_id: subscription.items.data[0]?.price.id ?? undefined,
    current_period_end: subscriptionPeriodEnd(subscription) ?? undefined,
  });
}

/** Opens the Stripe billing portal so a user can manage or cancel. */
export async function createUserBillingPortalSession(input: {
  userId: string;
  role: SubscriptionRole;
  requestUrl: string;
}): Promise<{ url: string }> {
  const existing = await getUserSubscriptionRow(input.userId);
  if (!existing?.stripe_customer_id) {
    throw new UserSubscriptionError(
      "not_found",
      "No subscription was found for this account.",
    );
  }
  const appUrl = publicAppUrl(input.requestUrl);
  const portal = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: `${appUrl}${subscriptionReturnPath(input.role)}`,
  });
  return { url: portal.url };
}
