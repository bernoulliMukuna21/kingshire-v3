// Creates (idempotently) the recurring Stripe Prices the subscription checkout
// needs, and prints the env lines to paste into Railway / .env.
//
// Usage (never inline your key):
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-subscription-prices.mjs
//
// Run it once per Stripe account/mode (test on staging, live on prod). Re-runs
// reuse the existing price via its lookup_key, so it won't create duplicates.

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY (test key for staging, live for prod).");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });

// Keep in step with lib/subscriptions/plans.ts (priceGBP + priceEnv).
const PLANS = [
  {
    lookupKey: "kingshire_client_standard",
    name: "KingsHire Client Subscription",
    gbp: 5,
    env: "STRIPE_CLIENT_SUBSCRIPTION_PRICE_ID",
  },
  {
    lookupKey: "kingshire_kinglancer_standard",
    name: "KingsHire Kinglancer Subscription",
    gbp: 5,
    env: "STRIPE_KINGLANCER_SUBSCRIPTION_PRICE_ID",
  },
];

const lines = [];
for (const plan of PLANS) {
  const existing = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });

  let price = existing.data[0];
  if (price) {
    console.log(`↺ reusing ${plan.name}: ${price.id}`);
  } else {
    const product = await stripe.products.create({ name: plan.name });
    price = await stripe.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: plan.gbp * 100,
      recurring: { interval: "month" },
      lookup_key: plan.lookupKey,
    });
    console.log(`✓ created ${plan.name}: ${price.id}`);
  }
  lines.push(`${plan.env}=${price.id}`);
}

console.log("\nAdd these to Railway / .env:\n");
console.log(lines.join("\n"));
