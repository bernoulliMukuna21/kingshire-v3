import { finishJobSettlement } from "./job-transfers";
import type { SettlementLedger } from "./dispatch";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementPayment } from "@/lib/db/engagement-payments";

/** Verify an existing external outcome. This function never moves money. */
export async function reconcileSettlementOutcome(
  paymentId: string,
  externalId: string,
  ledger: SettlementLedger = "engagement_payments",
): Promise<void> {
  const db = createServiceClient();
  const payment =
    ledger === "engagement_payments"
      ? await getEngagementPayment(paymentId)
      : await db
          .from("transactions")
          .select("*")
          .eq("id", paymentId)
          .single()
          .then(({ data, error }) => {
            if (error) throw error;
            return data;
          });
  if (!payment?.release_attempt_id)
    throw new Error("No reserved settlement to reconcile");
  const workerAmount = Number(
    "worker_amount" in payment ? payment.worker_amount : payment.amount,
  );
  const refundOperation = ["refund", "cancel_refund"].includes(
    payment.release_operation ?? "",
  );
  let patch;
  if (externalId.startsWith("tr_")) {
    if (
      refundOperation ||
      payment.stripe_refund_id ||
      payment.status === "refunded"
    ) {
      throw new Error("Conflicting refund requires manual investigation");
    }
    const transfer = await stripe.transfers.retrieve(externalId);
    const expected = Math.round(
      (workerAmount - Number(payment.platform_fee_kinglancer)) * 100,
    );
    const { data: worker, error } = await db
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", payment.kinglancer_id)
      .single();
    if (error) throw error;
    const destination =
      typeof transfer.destination === "string"
        ? transfer.destination
        : transfer.destination?.id;
    if (
      (ledger === "engagement_payments"
        ? transfer.metadata.engagement_payment_id
        : transfer.metadata.transaction_id) !== payment.id ||
      transfer.amount !== expected ||
      transfer.currency !== "gbp" ||
      transfer.reversed ||
      transfer.amount_reversed !== 0 ||
      destination !== worker?.stripe_account_id
    )
      throw new Error("Transfer does not match this payment");
    patch = {
      status: "released",
      stripe_transfer_id: transfer.id,
      released_at: new Date(transfer.created * 1000).toISOString(),
      settlement_error: null,
    };
  } else if (externalId.startsWith("re_")) {
    if (
      !refundOperation ||
      payment.stripe_transfer_id ||
      payment.status === "released"
    ) {
      throw new Error("Conflicting transfer requires manual investigation");
    }
    const refund = await stripe.refunds.retrieve(externalId);
    const intent =
      typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : refund.payment_intent?.id;
    const expected = Math.round(
      (workerAmount + Number(payment.platform_fee_client)) * 100,
    );
    if (
      intent !== payment.stripe_payment_intent_id ||
      refund.status !== "succeeded" ||
      refund.amount !== expected ||
      refund.currency !== "gbp"
    ) {
      throw new Error("Refund is not a completed full refund for this payment");
    }
    patch = {
      status: "refunded",
      stripe_refund_id: refund.id,
      settlement_error: null,
    };
  } else throw new Error("Provide an existing Stripe transfer or refund ID");
  if (ledger === "transactions") {
    await finishJobSettlement(
      paymentId,
      payment.release_attempt_id,
      externalId,
    );
    return;
  }
  const { data, error } = await db
    .from("engagement_payments")
    .update({ ...patch, release_outcome: "succeeded" })
    .eq("id", paymentId)
    .eq("release_attempt_id", payment.release_attempt_id)
    .in("status", ["held", "disputed", patch.status])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Payment changed; reconciliation was not applied");
}
