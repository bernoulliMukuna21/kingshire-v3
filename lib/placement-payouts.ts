import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getPlacementPayment,
  updatePlacementPaymentStatus,
  type PlacementPaymentRow,
} from "@/lib/db/placement-payments";

/**
 * Marks a monthly payment as funded (held) from a completed Checkout session,
 * then pays out to the Kinglancer if they've onboarded to Stripe. Idempotent.
 */
export async function fulfillPlacementPayment(
  paymentId: string,
  paymentIntentId: string | null,
): Promise<void> {
  const payment = await getPlacementPayment(paymentId);
  if (!payment) return;
  if (payment.status === "held" || payment.status === "released") return;

  const stripePi = paymentIntentId ?? payment.stripe_payment_intent_id;
  await updatePlacementPaymentStatus(payment.id, {
    status: "held",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: stripePi,
  });

  await firePlacementPayout({
    ...payment,
    status: "held",
    stripe_payment_intent_id: stripePi,
  }).catch((err) =>
    console.error(`[placement payout] failed for ${payment.id}:`, err),
  );
}

/**
 * Transfers the Kinglancer's net (amount − fee) to their connected account.
 * No-op if not onboarded (stays 'held' until they complete onboarding) or if
 * a transfer already exists.
 */
export async function firePlacementPayout(
  payment: PlacementPaymentRow,
): Promise<void> {
  if (payment.stripe_transfer_id) return;

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", payment.kinglancer_id)
    .single();

  if (!profile?.stripe_onboarding_complete || !profile.stripe_account_id) {
    return;
  }

  const netPence = Math.round(
    (Number(payment.amount) - Number(payment.platform_fee_kinglancer)) * 100,
  );
  if (netPence <= 0) return;

  // Pull from the specific charge (separate charges + transfers), as jobs do.
  let sourceTransaction: string | undefined;
  if (payment.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
      );
      const charge = pi.latest_charge;
      if (charge) {
        sourceTransaction = typeof charge === "string" ? charge : charge.id;
      }
    } catch (err) {
      console.warn(
        "[placement payout] could not resolve charge, proceeding:",
        err,
      );
    }
  }

  const transfer = await stripe.transfers.create(
    {
      amount: netPence,
      currency: "gbp",
      destination: profile.stripe_account_id,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
      metadata: {
        placement_payment_id: payment.id,
        agreement_id: payment.agreement_id,
      },
    },
    { idempotencyKey: `placement-transfer-${payment.id}` },
  );

  await updatePlacementPaymentStatus(payment.id, {
    status: "released",
    stripe_transfer_id: transfer.id,
    released_at: new Date().toISOString(),
  });
}

/** Fire any funded-but-untransferred payouts for a Kinglancer (post-onboarding). */
export async function firePendingPlacementPayouts(
  kinglancerId: string,
): Promise<void> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_payments")
    .select("*")
    .eq("kinglancer_id", kinglancerId)
    .eq("status", "held")
    .is("stripe_transfer_id", null);

  for (const payment of (data ?? []) as PlacementPaymentRow[]) {
    await firePlacementPayout(payment).catch((err) =>
      console.error(`[placement payout] pending fire failed:`, err),
    );
  }
}
