import { transferJobPayment as fireTransfer } from "@/lib/settlement/job-transfers";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import type Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Get an existing Stripe Express account ID for a kinglancer, or create one.
 * Saves the ID to the profile row on creation.
 */
export async function getOrCreateStripeAccount(
  kinglancerId: string,
  email: string,
  existingAccountId: string | null,
  fullName?: string,
): Promise<string> {
  if (existingAccountId) return existingAccountId;

  const [firstName, ...rest] = (fullName ?? "").trim().split(" ");
  const lastName = rest.join(" ") || undefined;

  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    email,
    business_type: "individual",
    business_profile: {
      url: "https://kingshire.uk",
      ...(fullName ? { name: fullName } : {}),
    },
    individual: {
      email,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    },
    capabilities: {
      transfers: { requested: true },
    },
  });

  const db = createServiceClient();
  await db
    .from("profiles")
    .update({ stripe_account_id: account.id })
    .eq("id", kinglancerId);

  return account.id;
}

/**
 * Generate a one-time Stripe Connect onboarding link for the given account.
 * The link expires after a few minutes — call this fresh each time.
 */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: `${APP_URL}/dashboard/kinglancer/payouts?status=complete`,
    refresh_url: `${APP_URL}/dashboard/kinglancer?payouts=refresh`,
    type: "account_onboarding",
  });
  return link.url;
}

export function isStripeAccountPayoutReady(account: Stripe.Account) {
  return (
    account.payouts_enabled === true &&
    account.capabilities?.transfers === "active"
  );
}

export async function getStripePayoutStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);

  return {
    detailsSubmitted: account.details_submitted === true,
    payoutsEnabled: isStripeAccountPayoutReady(account),
    chargesEnabled: account.charges_enabled === true,
    disabledReason: account.requirements?.disabled_reason ?? null,
    currentlyDue: account.requirements?.currently_due ?? [],
  };
}

export async function syncStripePayoutStatus({
  kinglancerId,
  accountId,
}: {
  kinglancerId: string;
  accountId: string;
}) {
  const status = await getStripePayoutStatus(accountId);
  const db = createServiceClient();

  await db
    .from("profiles")
    .update({ stripe_onboarding_complete: status.payoutsEnabled })
    .eq("id", kinglancerId)
    .eq("stripe_account_id", accountId);

  // If payouts just became enabled, fire any transfers that were deferred
  // because the kinglancer hadn't completed onboarding at approval time.
  // This is a safety net — the account.updated webhook does the same thing,
  // but this covers the case where the webhook event wasn't received.
  if (status.payoutsEnabled) {
    const { data: pendingTx } = await db
      .from("transactions")
      .select(
        "id, job_id, amount, platform_fee_kinglancer, stripe_payment_intent_id",
      )
      .eq("kinglancer_id", kinglancerId)
      .eq("status", "released")
      .is("stripe_transfer_id", null);

    for (const tx of pendingTx ?? []) {
      const amountPence = Math.round(
        (tx.amount - tx.platform_fee_kinglancer) * 100,
      );
      await fireTransfer({
        transactionId: tx.id,
        amountPence,
        destinationAccountId: accountId,
        jobId: tx.job_id,
        paymentIntentId: tx.stripe_payment_intent_id ?? undefined,
      }).catch((err) =>
        console.error(
          `[syncStripePayoutStatus] Transfer failed for tx ${tx.id}:`,
          err,
        ),
      );
    }

    // Release any funded-but-untransferred managed placement payments too.
    const { firePendingPlacementPayouts } =
      await import("@/lib/placement-payouts");
    await firePendingPlacementPayouts(kinglancerId).catch((err) =>
      console.error(`[syncStripePayoutStatus] Placement payouts failed:`, err),
    );
  }

  return status;
}

/**
 * Transfer the kinglancer's net earnings from the platform Stripe balance
 * to their connected Express account, then record the transfer ID.
 *
 * Pass `paymentIntentId` so the transfer is linked to the original charge
 * via `source_transaction` — required in Marketplace mode to pull from the
 * specific charge rather than the platform's general available balance.
 */
export { transferJobPayment as fireTransfer } from "@/lib/settlement/job-transfers";
