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
// (client) a smaller one plus a fixed component that covers Stripe's per-
// transaction fee. Total platform take ≈ 12.5% + 30p.
export const PLATFORM_FEE_RATE_CLIENT = 0.05;
export const PLATFORM_FEE_RATE_KINGLANCER = 0.075;
// Fixed component (£) added to the client service fee — covers Stripe's ~20p.
export const PLATFORM_FEE_FIXED_CLIENT = 0.3;
// Minimum job budget (£) — small jobs are unprofitable after Stripe fees.
export const MIN_JOB_BUDGET_GBP = 20;

/**
 * Calculates the Stripe charge amount (in pence) and fee breakdown
 * for a given job budget in £.
 *
 * Client pays: budget + 5% + 30p on top
 * Kinglancer receives: budget − 7.5%
 *
 * `includeFixed` defaults to true (card route). The bank-transfer route passes
 * false — there is no Stripe fee to cover, so the fixed 30p is dropped.
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
