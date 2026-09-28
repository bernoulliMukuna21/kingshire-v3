import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import { dispatchSettlement } from "./dispatch";

export async function reserveJobSettlement(
  paymentId: string,
  action: string,
  disputeId?: string,
) {
  const { data, error } = await createServiceClient().rpc(
    "reserve_job_settlement",
    {
      p_payment: paymentId,
      p_action: action,
      p_dispute: disputeId ?? null,
    },
  );
  if (error) throw error;
  if (!data?.release_attempt_id)
    throw new Error(
      "Payment is no longer eligible or another settlement is in progress",
    );
  return data;
}

export async function finishJobSettlement(
  paymentId: string,
  attemptId: string,
  externalId?: string,
  reference?: string,
  actorId?: string,
) {
  const { data, error } = await createServiceClient().rpc(
    "finish_job_settlement",
    {
      p_payment: paymentId,
      p_attempt: attemptId,
      p_external: externalId ?? null,
      p_reference: reference ?? null,
      p_actor: actorId ?? null,
    },
  );
  if (error) throw error;
  if (!data?.id) throw new Error("Settlement was not recorded");
  return data;
}

export async function transferJobPayment(input: {
  transactionId: string;
  amountPence: number;
  destinationAccountId: string;
  jobId: string;
  paymentIntentId?: string;
  disputeId?: string;
}) {
  const db = createServiceClient();
  const { data: existing, error } = await db
    .from("transactions")
    .select("*")
    .eq("id", input.transactionId)
    .single();
  if (error || !existing)
    throw new Error("Cannot verify the transaction before transferring funds.");
  if (
    existing.manual_payout_reference ||
    (existing.payout_method === "manual" && existing.status === "released")
  ) {
    throw new Error(
      "This transaction was settled manually; Stripe transfer blocked.",
    );
  }
  if (existing.stripe_transfer_id) return;
  const { data: worker, error: workerError } = await db
    .from("profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", existing.kinglancer_id)
    .single();
  if (workerError) throw workerError;
  if (
    !worker?.stripe_onboarding_complete ||
    worker.stripe_account_id !== input.destinationAccountId
  )
    throw new Error("Payout account is not ready");
  const payment = await reserveJobSettlement(
    existing.id,
    "transfer",
    input.disputeId,
  );
  const amount = Math.round(
    (Number(payment.amount) - Number(payment.platform_fee_kinglancer)) * 100,
  );
  if (
    payment.job_id !== input.jobId ||
    amount !== input.amountPence ||
    !payment.stripe_payment_intent_id
  )
    throw new Error(
      "Payment details changed; recover the undispatched reservation",
    );
  const intent = await stripe.paymentIntents.retrieve(
    payment.stripe_payment_intent_id,
  );
  const charge =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id;
  if (!charge || intent.status !== "succeeded")
    throw new Error("Original funding has not been confirmed");
  const transfer = await dispatchSettlement(
    "transactions",
    payment.id,
    payment.release_attempt_id,
    {
      kind: "transfer",
      params: {
        amount,
        currency: "gbp",
        destination: input.destinationAccountId,
        source_transaction: charge,
        metadata: { transaction_id: payment.id, job_id: payment.job_id },
      },
    },
  );
  await finishJobSettlement(
    payment.id,
    payment.release_attempt_id,
    transfer.id,
  );
}

export async function refundJobPayment(
  paymentId: string,
  options: { disputeId?: string; cancellation?: boolean } = {},
) {
  const payment = await reserveJobSettlement(
    paymentId,
    options.cancellation ? "cancel_refund" : "refund",
    options.disputeId,
  );
  if (!payment.stripe_payment_intent_id)
    throw new Error("No funding reference");
  const refund = await dispatchSettlement(
    "transactions",
    payment.id,
    payment.release_attempt_id,
    {
      kind: "refund",
      params: {
        payment_intent: payment.stripe_payment_intent_id,
        metadata: { transaction_id: payment.id, job_id: payment.job_id },
      },
    },
  );
  await finishJobSettlement(payment.id, payment.release_attempt_id, refund.id);
}
