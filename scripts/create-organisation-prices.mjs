// Creates (idempotently) the repriced Organisation Stripe Prices and prints the
// env lines to paste into Railway / .env. Reuses each tier's existing Stripe
// product (derived from the current price env var) so only the amount changes.
//
// Usage (never inline your key — export it, or prefix the command):
//   STRIPE_SECRET_KEY=sk_test_... node scripts/create-organisation-prices.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/create-organisation-prices.mjs --live
//
// Run once per Stripe mode (test on staging, live on prod). Re-runs reuse the
// price via its lookup_key, so it won't create duplicates. Growth (£25) is
// unchanged and is not touched.

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error(
    "Set STRIPE_SECRET_KEY (test key for staging, live key for prod).",
  );
  process.exit(1);
}

// Guard: never create live prices unless the operator explicitly opts in.
const isLive = secretKey.startsWith("sk_live_");
if (isLive && !process.argv.includes("--live")) {
  console.error(
    "Refusing to run against a LIVE key without --live. Re-run with --live to create live prices.",
  );
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });

// Only the two tiers whose price changes. Keep in step with
// modules/organisations/domain/plans.ts (monthlyPriceGBP).
const TIERS = [
  {
    name: "Starter",
    gbp: 10,
    env: "STRIPE_ORGANISATION_STARTER_PRICE_ID",
    lookupKey: "kingshire_org_starter_1000",
    fallbackProductName: "KingsHire Organisation Starter",
  },
  {
    name: "Scale",
    gbp: 50,
    env: "STRIPE_ORGANISATION_SCALE_PRICE_ID",
    lookupKey: "kingshire_org_scale_5000",
    fallbackProductName: "KingsHire Organisation Scale",
  },
];

console.log(`Stripe mode: ${isLive ? "LIVE" : "test"}\n`);

const lines = [];
for (const tier of TIERS) {
  // Reuse the existing price by lookup_key if we've already created it.
  const existing = await stripe.prices.list({
    lookup_keys: [tier.lookupKey],
    active: true,
    limit: 1,
  });

  let price = existing.data[0];
  if (price) {
    console.log(`↺ reusing ${tier.name} £${tier.gbp}: ${price.id}`);
  } else {
    // Reuse the tier's current Stripe product so the name/branding is kept;
    // fall back to a fresh product if the current price env isn't available.
    let productId;
    const currentPriceId = process.env[tier.env];
    if (currentPriceId) {
      try {
        const current = await stripe.prices.retrieve(currentPriceId);
        productId =
          typeof current.product === "string"
            ? current.product
            : current.product.id;
      } catch {
        productId = undefined;
      }
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: tier.fallbackProductName,
      });
      productId = product.id;
    }

    price = await stripe.prices.create({
      product: productId,
      currency: "gbp",
      unit_amount: tier.gbp * 100,
      recurring: { interval: "month" },
      lookup_key: tier.lookupKey,
    });
    console.log(`✓ created ${tier.name} £${tier.gbp}: ${price.id}`);
  }
  lines.push(`${tier.env}=${price.id}`);
}

console.log("\nAdd these to Railway / .env (Growth is unchanged):\n");
console.log(lines.join("\n"));
