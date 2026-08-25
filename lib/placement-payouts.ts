import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getPlacementPayment,
  updatePlacementPaymentStatus,
  type PlacementPaymentRow,
} from "@/lib/db/placement-payments";
import { activateAgreement } from "@/lib/db/placements";
import { notifyPlacementReleasePending } from "@/lib/notifications";

/** Days before month-end that we warn the org the payment will release. */
export const RELEASE_NOTICE_DAYS = 7;

/** Adds whole calendar months to a date. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** End of the month a payment covers (release becomes due at this point). */
export function placementPeriodEnd(dueDate: string): Date {
  return addMonths(new Date(dueDate), 1);
}

/**
 * Marks a monthly payment as funded and held in escrow. Release to the
 * Kinglancer happens at month-end via processPlacementReleases, NOT here.
 * Idempotent.
 */
export async function fulfillPlacementPayment(
  paymentId: string,
  paymentIntentId: string | null,
): Promise<void> {
  const payment = await getPlacementPayment(paymentId);
  if (!payment) return;
  if (
    payment.status === "held" ||
    payment.status === "released" ||
    payment.status === "disputed"
  ) {
    return;
  }

  const stripePi = paymentIntentId ?? payment.stripe_payment_intent_id;
  await updatePlacementPaymentStatus(payment.id, {
    status: "held",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: stripePi,
  });

  // The first funded month starts the placement (Kinglancer has accepted).
  if (payment.period_index === 1) {
    await activateAgreement(payment.agreement_id).catch((err) =>
      console.error(`[placement payout] activate failed:`, err),
    );
  }
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

/** Fire any released-but-untransferred payouts for a Kinglancer
 * (post-onboarding). Only months whose review window has ended. */
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

  const now = Date.now();
  for (const payment of (data ?? []) as PlacementPaymentRow[]) {
    if (!payment.due_date) continue;
    if (placementPeriodEnd(payment.due_date).getTime() > now) continue;
    await firePlacementPayout(payment).catch((err) =>
      console.error(`[placement payout] pending fire failed:`, err),
    );
  }
}

/**
 * Month-end release worker (run by cron): emails the org the release notice
 * ~7 days before month-end, then releases held escrow to the Kinglancer once
 * the month is over — unless the org disputed it (status is then 'disputed'
 * and excluded here).
 */
export async function processPlacementReleases(): Promise<{
  released: number;
  noticed: number;
}> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_payments")
    .select("*")
    .eq("status", "held")
    .is("stripe_transfer_id", null);

  const now = Date.now();
  let released = 0;
  let noticed = 0;

  for (const payment of (data ?? []) as PlacementPaymentRow[]) {
    if (!payment.due_date) continue;
    const periodEndMs = placementPeriodEnd(payment.due_date).getTime();

    if (now >= periodEndMs) {
      await firePlacementPayout(payment).catch((err) =>
        console.error(`[placement release] failed for ${payment.id}:`, err),
      );
      released += 1;
      continue;
    }

    const noticeStart = periodEndMs - RELEASE_NOTICE_DAYS * 86_400_000;
    if (now >= noticeStart && !payment.notice_sent_at) {
      const { data: org } = await db
        .from("organisations")
        .select("email")
        .eq("id", payment.organisation_id)
        .maybeSingle();
      const { data: agreement } = await db
        .from("placement_agreements")
        .select("placement:placements(title)")
        .eq("id", payment.agreement_id)
        .maybeSingle();
      const placementTitle =
        (agreement as { placement: { title: string } | null } | null)?.placement
          ?.title ?? "your placement";
      if (org?.email) {
        await notifyPlacementReleasePending({
          organisationEmail: org.email,
          placementTitle,
          agreementId: payment.agreement_id,
          periodIndex: payment.period_index,
          releaseDate: placementPeriodEnd(payment.due_date).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" },
          ),
        }).catch((err) =>
          console.error(`[placement release] notice failed:`, err),
        );
      }
      await updatePlacementPaymentStatus(payment.id, {
        notice_sent_at: new Date().toISOString(),
      });
      noticed += 1;
    }
  }

  return { released, noticed };
}
