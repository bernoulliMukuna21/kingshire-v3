// Subscription plans for individual users (client & kinglancer). One flat plan
// per role for now; the shape leaves room for tiers/perks without a schema
// change. Organisation plans live in modules/organisations/domain/plans.ts.

export type SubscriptionRole = "client" | "kinglancer";

export type SubscriptionPlan = {
  id: string;
  role: SubscriptionRole;
  name: string;
  priceGBP: number;
  priceEnv: string;
  entitlements: {
    /** Client: may pay for jobs below the card threshold by card. */
    cardBelowThreshold?: boolean;
    /** Kinglancer: paid out automatically via Stripe (else manual payout). */
    stripePayout?: boolean;
    /** Kinglancer: may apply to jobs below the small-job threshold. */
    applyToSmallJobs?: boolean;
  };
};

export const SUBSCRIPTION_PLANS = {
  client_standard: {
    id: "client_standard",
    role: "client",
    name: "Client",
    priceGBP: 10,
    priceEnv: "STRIPE_CLIENT_SUBSCRIPTION_PRICE_ID",
    entitlements: { cardBelowThreshold: true },
  },
  kinglancer_standard: {
    id: "kinglancer_standard",
    role: "kinglancer",
    name: "Kinglancer",
    priceGBP: 5,
    priceEnv: "STRIPE_KINGLANCER_SUBSCRIPTION_PRICE_ID",
    entitlements: { stripePayout: true, applyToSmallJobs: true },
  },
} satisfies Record<string, SubscriptionPlan>;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

// The single plan a given role subscribes to today.
const PLAN_BY_ROLE: Record<SubscriptionRole, SubscriptionPlanId> = {
  client: "client_standard",
  kinglancer: "kinglancer_standard",
};

export function planForRole(role: SubscriptionRole): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[PLAN_BY_ROLE[role]];
}

export function getSubscriptionPlan(
  planId: string,
): SubscriptionPlan | undefined {
  return (SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>)[planId];
}
