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
export async function fireTransfer({
  transactionId,
  amountPence,
  destinationAccountId,
  jobId,
  paymentIntentId,
}: {
  transactionId: string;
  amountPence: number;
  destinationAccountId: string;
  jobId: string;
  paymentIntentId?: string;
}): Promise<void> {
  // Idempotency: skip if a transfer was already recorded for this transaction.
  // Secondary safety net — Stripe's idempotency key below is the real concurrent-safe guard.
  const db = createServiceClient();
  const { data: existingTx } = await db
    .from("transactions")
    .select("stripe_transfer_id")
    .eq("id", transactionId)
    .single();

  if (existingTx?.stripe_transfer_id) {
    console.log(
      `[fireTransfer] Transfer already exists for tx ${transactionId}, skipping`,
    );
    return;
  }

  // Resolve the underlying charge so we can use source_transaction.
  // This is the correct pattern for "separate charges and transfers" in
  // Marketplace mode — without it, Stripe draws from available balance (£0
  // in test mode / before settlement).
  let sourceTransaction: string | undefined;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      const charge = pi.latest_charge;
      if (charge) {
        sourceTransaction = typeof charge === "string" ? charge : charge.id;
      }
    } catch (err) {
      console.warn(
        "[fireTransfer] Could not resolve charge from PaymentIntent, proceeding without source_transaction:",
        err,
      );
    }
  }

  const transfer = await stripe.transfers.create(
    {
      amount: amountPence,
      currency: "gbp",
      destination: destinationAccountId,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
      metadata: { transaction_id: transactionId, job_id: jobId },
    },
    // Stripe-side idempotency: if two callers race through the pre-check above,
    // Stripe deduplicates on this key and returns the same transfer both times.
    { idempotencyKey: `transfer-${transactionId}` },
  );

  const { error: dbUpdateError } = await db
    .from("transactions")
    .update({ stripe_transfer_id: transfer.id })
    .eq("id", transactionId);

  if (dbUpdateError) {
    // The Stripe transfer succeeded but the DB record wasn't updated.
    // Log critically so this can be reconciled manually — do NOT swallow.
    console.error(
      `[fireTransfer] CRITICAL: Stripe transfer ${transfer.id} created for tx ${transactionId} but DB update failed:`,
      dbUpdateError.message,
    );
    throw new Error(
      `Transfer created in Stripe (${transfer.id}) but failed to save to DB: ${dbUpdateError.message}`,
    );
  }
}
