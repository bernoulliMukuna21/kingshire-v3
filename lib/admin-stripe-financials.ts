import { stripe } from "@/lib/stripe";
import { deriveStripeActivity, type StripeMovement } from "@/lib/admin-financials";

/** Call only after admin authorization. Exhaust Stripe's pagination so older
 * subscriptions, fees, transfers and owner funding are included. */
export async function getAdminStripeActivity() {
  const movements: StripeMovement[] = [];
  for await (const movement of stripe.balanceTransactions.list({ limit: 100 })) {
    movements.push(movement);
  }
  return deriveStripeActivity(movements);
}
