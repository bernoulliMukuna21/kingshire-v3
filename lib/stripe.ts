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

// Fee config — 5% from each side (10% total)
export const PLATFORM_FEE_RATE = 0.05;

/**
 * Calculates the Stripe charge amount (in pence) and fee breakdown
 * for a given job budget in £.
 *
 * Client pays: budget + 5% on top
 * Kinglancer receives: budget − 5%
 */
export function calculateFees(budgetGBP: number) {
  const platformFeeClient =
    Math.round(budgetGBP * PLATFORM_FEE_RATE * 100) / 100;
  const platformFeeKinglancer =
    Math.round(budgetGBP * PLATFORM_FEE_RATE * 100) / 100;
  const clientChargeGBP = budgetGBP + platformFeeClient;
  const clientChargePence = Math.round(clientChargeGBP * 100);
  return {
    platformFeeClient,
    platformFeeKinglancer,
    clientChargeGBP,
    clientChargePence,
  };
}
