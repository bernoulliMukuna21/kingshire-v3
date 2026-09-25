import { createServiceClient } from "@/lib/supabase/service";
import { getEngagement, markEngagementActive } from "@/lib/db/engagements";
import { getEngagementPayment } from "@/lib/db/engagement-payments";
import { ensureEngagementSchedule } from "./schedules";

/** Resumable effects after verified Stripe success. Never rewinds a settled,
 * disputed or refunded payment. fulfilled_at is written LAST, making every
 * preceding step independently retryable by both webhooks and the cron. */
export async function fulfilEngagementPayment(
  paymentId: string,
  intentId: string,
): Promise<void> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (
    payment.stripe_payment_intent_id &&
    payment.stripe_payment_intent_id !== intentId
  ) {
    throw new Error("PaymentIntent does not match the recorded payment");
  }
  if (payment.fulfilled_at) return;
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement) throw new Error("Engagement not found");
  const db = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("engagement_payments")
    .update({
      status: engagement.settlement_mode === "direct" ? "released" : "held",
      stripe_payment_intent_id: intentId,
      charged_at: now,
      ...(engagement.settlement_mode === "direct" ? { released_at: now } : {}),
    })
    .eq("id", payment.id)
    .in("status", ["due", "processing", "failed"])
    .or(
      `stripe_payment_intent_id.is.null,stripe_payment_intent_id.eq.${intentId}`,
    );
  if (error) throw error;
  const recorded = await getEngagementPayment(payment.id);
  if (!recorded || recorded.stripe_payment_intent_id !== intentId)
    throw new Error("Payment was not recorded; reconciliation required");
  if (!["held", "released"].includes(recorded.status)) return;

  if (payment.period_index === 1) {
    await markEngagementActive(engagement.id);
    if (engagement.source_kind === "placement") {
      const { error: activationError } = await db
        .from("placement_agreements")
        .update({ status: "active" })
        .eq("id", engagement.source_id)
        .eq("status", "pending_funding");
      if (activationError) throw activationError;
    }
  }
  // Placements already have a complete, prorated fixed schedule. Rebuilding
  // those through the generic role scheduler would lose their final amount.
  if (engagement.source_kind === "org_role") {
    await ensureEngagementSchedule(engagement.id, payment.period_index + 1);
  }
  const { error: finishError } = await db
    .from("engagement_payments")
    .update({ fulfilled_at: now })
    .eq("id", payment.id)
    .eq("stripe_payment_intent_id", intentId)
    .in("status", ["held", "released"]);
  if (finishError) throw finishError;
}
