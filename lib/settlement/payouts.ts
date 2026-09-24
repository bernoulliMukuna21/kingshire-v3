import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getEngagement,
  type Engagement,
} from "@/lib/db/engagements";
import {
  getHeldEngagementPayments,
  updateEngagementPaymentStatus,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import { periodEnd, releaseNoticeDays } from "./schedule";

export type EngagementPayoutResult =
  | "released"
  | "pending_onboarding"
  | "already_transferred"
  | "skipped"
  | "not_eligible";

export async function releaseEngagementPayment(
  paymentId: string,
): Promise<EngagementPayoutResult> {
  const db = createServiceClient();
  const { data: payment, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  // Admin may release a 'disputed' period directly (bypassing the normal
  // held→released cron path), so this accepts both — matching the pre-engine
  // Placement payout behaviour, which had no status guard beyond the transfer id.
  if (!payment || (payment.status !== "held" && payment.status !== "disputed")) {
    return "not_eligible";
  }
  if (payment.stripe_transfer_id) return "already_transferred";

  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || engagement.settlement_mode !== "managed") {
    return "not_eligible";
  }

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", payment.kinglancer_id)
    .single();
  if (!profile?.stripe_onboarding_complete || !profile.stripe_account_id) {
    return "pending_onboarding";
  }

  const netPence = Math.round(
    (Number(payment.worker_amount) -
      Number(payment.platform_fee_kinglancer)) *
      100,
  );
  if (netPence <= 0) return "skipped";

  let sourceTransaction: string | undefined;
  if (payment.stripe_payment_intent_id) {
    try {
      const intent = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
      );
      const charge = intent.latest_charge;
      if (charge) {
        sourceTransaction = typeof charge === "string" ? charge : charge.id;
      }
    } catch (error) {
      console.warn("[settlement] could not resolve source charge:", error);
    }
  }

  const transfer = await stripe.transfers.create(
    {
      amount: netPence,
      currency: "gbp",
      destination: profile.stripe_account_id,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
      metadata: {
        engagement_payment_id: payment.id,
        engagement_id: payment.engagement_id,
      },
    },
    { idempotencyKey: `engagement-transfer-${payment.id}` },
  );

  await updateEngagementPaymentStatus(payment.id, "released", {
    stripe_transfer_id: transfer.id,
    released_at: new Date().toISOString(),
  });
  return "released";
}

function periodEndTimestamp(
  payment: EngagementPaymentRow,
  engagement: Engagement,
): number {
  return periodEnd(
    new Date(`${payment.due_date}T00:00:00.000Z`),
    engagement.cadence,
  ).getTime();
}

export type ProcessReleaseResult = {
  released: number;
  noticed: number;
  pendingOnboarding: number;
};

/** Release eligible managed periods and mark upcoming periods as noticed. */
export async function processEngagementReleases(): Promise<ProcessReleaseResult> {
  const payments = await getHeldEngagementPayments();
  const now = Date.now();
  let released = 0;
  let noticed = 0;
  let pendingOnboarding = 0;

  for (const payment of payments) {
    const engagement = await getEngagement(payment.engagement_id);
    if (!engagement || engagement.settlement_mode !== "managed") continue;

    const end = periodEndTimestamp(payment, engagement);
    if (end <= now) {
      const result = await releaseEngagementPayment(payment.id);
      if (result === "released") released += 1;
      if (result === "pending_onboarding") pendingOnboarding += 1;
      continue;
    }

    const noticeAt =
      end - releaseNoticeDays(engagement.cadence) * 24 * 60 * 60 * 1000;
    if (now >= noticeAt && !payment.notice_sent_at) {
      await updateEngagementPaymentStatus(payment.id, "held", {
        notice_sent_at: new Date().toISOString(),
      });
      noticed += 1;
    }
  }

  return { released, noticed, pendingOnboarding };
}
