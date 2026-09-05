import Stripe from "stripe";

function createStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return (
      createStripeClient() as unknown as Record<string | symbol, unknown>
    )[prop];
  },
});

// Fee config — the earner (kinglancer) carries the larger cut, the buyer
// (client) a smaller one. Total platform take = 7.5%. Card processing costs are
// covered by subscriptions (card is subscriber-only below a threshold), so no
// per-transaction fixed fee is charged on top.
export const PLATFORM_FEE_RATE_CLIENT = 0.025;
export const PLATFORM_FEE_RATE_KINGLANCER = 0.05;
// Fixed component (£) added to the client service fee. Kept at 0 — Stripe's
// per-transaction cost is covered by the client subscription.
export const PLATFORM_FEE_FIXED_CLIENT = 0;
// Minimum job budget (£). Small jobs are subscriber-gated (see lib/payments/
// policy.ts) rather than blocked, so the hard floor can be low.
export const MIN_JOB_BUDGET_GBP = 10;

/**
 * Calculates the Stripe charge amount (in pence) and fee breakdown
 * for a given job budget in £.
 *
 * Client pays: budget + 2.5%
 * Kinglancer receives: budget − 5%
 *
 * `includeFixed` defaults to true (card route). The bank-transfer route passes
 * false. The fixed component is currently 0, so it has no effect either way.
 */
export function calculateFees(
  budgetGBP: number,
  opts?: { includeFixed?: boolean },
) {
  const fixed = (opts?.includeFixed ?? true) ? PLATFORM_FEE_FIXED_CLIENT : 0;
  const platformFeeClient =
    Math.round((budgetGBP * PLATFORM_FEE_RATE_CLIENT + fixed) * 100) / 100;
  const platformFeeKinglancer =
    Math.round(budgetGBP * PLATFORM_FEE_RATE_KINGLANCER * 100) / 100;
  const clientChargeGBP = budgetGBP + platformFeeClient;
  const clientChargePence = Math.round(clientChargeGBP * 100);
  return {
    platformFeeClient,
    platformFeeKinglancer,
    clientChargeGBP,
    clientChargePence,
  };
}
