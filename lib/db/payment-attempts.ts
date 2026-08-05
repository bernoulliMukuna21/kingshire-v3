import {
  ApplicantSelectionConflictError,
  selectApplicant,
} from "@/lib/db/applications";
import { canManageJob } from "@/lib/organisations";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export type PaymentAttemptRow =
  Database["public"]["Tables"]["payment_attempts"]["Row"];
export type PaymentAttemptInsert =
  Database["public"]["Tables"]["payment_attempts"]["Insert"];
export type PaymentAttemptStatus = PaymentAttemptRow["status"];

type FinalizeResult = {
  attempt: PaymentAttemptRow | null;
  finalizedNow: boolean;
};

type FinalizeJob = {
  id: string;
  client_id: string;
  organisation_id: string | null;
  status: Database["public"]["Tables"]["jobs"]["Row"]["status"];
  kinglancer_id: string | null;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
};

export const CANCELLABLE_PAYMENT_INTENT_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
] as const;

export function isCancellablePaymentIntentStatus(status: string) {
  return CANCELLABLE_PAYMENT_INTENT_STATUSES.includes(
    status as (typeof CANCELLABLE_PAYMENT_INTENT_STATUSES)[number],
  );
}

export function getPaymentIntentIdFromClientSecret(clientSecret: string) {
  const [paymentIntentId] = clientSecret.split("_secret_");
  return paymentIntentId?.startsWith("pi_") ? paymentIntentId : null;
}

export async function createPaymentAttempt(data: PaymentAttemptInsert) {
  const db = createServiceClient();
  const { data: attempt, error } = await db
    .from("payment_attempts")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return attempt as PaymentAttemptRow;
}

export async function getPendingPaymentAttemptByJob(jobId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("payment_attempts")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) return null;
  return data as PaymentAttemptRow | null;
}

export async function getPaymentAttemptByPaymentIntent(
  stripePaymentIntentId: string,
) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("payment_attempts")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle();

  if (error) return null;
  return data as PaymentAttemptRow | null;
}

export async function updatePaymentAttemptStatus(
  stripePaymentIntentId: string,
  status: PaymentAttemptStatus,
) {
  const db = createServiceClient();
  const { error } = await db
    .from("payment_attempts")
    .update({ status })
    .eq("stripe_payment_intent_id", stripePaymentIntentId);

  if (error) throw error;
}

export async function finalizePaymentAttempt(
  stripePaymentIntentId: string,
): Promise<FinalizeResult> {
  const db = createServiceClient();

  const { data: attemptRaw, error: attemptError } = await db
    .from("payment_attempts")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle();

  if (attemptError) throw attemptError;

  const attempt = attemptRaw as PaymentAttemptRow | null;

  // Legacy fallback: older pending transactions were created before the
  // payment_attempts table existed.
  if (!attempt) {
    await db
      .from("transactions")
      .update({ status: "held" })
      .eq("stripe_payment_intent_id", stripePaymentIntentId)
      .eq("status", "pending");
    return { attempt: null, finalizedNow: false };
  }

  const { data: existingTransaction, error: existingError } = await db
    .from("transactions")
    .select("id, stripe_payment_intent_id, status")
    .eq("job_id", attempt.job_id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingTransaction) {
    if (
      existingTransaction.stripe_payment_intent_id &&
      existingTransaction.stripe_payment_intent_id !== stripePaymentIntentId
    ) {
      throw new Error("A different payment has already funded this job");
    }

    await Promise.all([
      db
        .from("transactions")
        .update({
          status: "held",
          stripe_payment_intent_id: stripePaymentIntentId,
        })
        .eq("id", existingTransaction.id),
      updatePaymentAttemptStatus(stripePaymentIntentId, "succeeded"),
    ]);

    return { attempt, finalizedNow: false };
  }

  const { data: jobRaw, error: jobError } = await db
    .from("jobs")
    .select(
      "id, client_id, organisation_id, status, kinglancer_id, invited_kinglancer_id, direct_request_status",
    )
    .eq("id", attempt.job_id)
    .single();

  if (jobError) throw jobError;

  const job = jobRaw as FinalizeJob;
  // The payer is stored in attempt.client_id. For personal jobs this must be
  // the job owner; for organisation jobs any current member with job
  // permission may fund it (re-checked here in case membership changed).
  if (!(await canManageJob(job, attempt.client_id))) {
    throw new Error("Payment attempt payer is not authorised for this job");
  }

  if (attempt.attempt_type === "application") {
    if (!attempt.application_id) {
      throw new Error("Application payment attempt is missing application_id");
    }

    if (job.status === "open") {
      await selectApplicant(
        attempt.job_id,
        attempt.application_id,
        attempt.kinglancer_id,
      );
    } else if (
      job.status !== "in_progress" ||
      job.kinglancer_id !== attempt.kinglancer_id
    ) {
      throw new ApplicantSelectionConflictError();
    }
  } else {
    if (job.status === "open") {
      if (
        job.invited_kinglancer_id !== attempt.kinglancer_id ||
        job.direct_request_status !== "accepted_pending_payment"
      ) {
        throw new Error("Direct request is no longer ready for payment");
      }

      const { data: reservedJob, error: reserveError } = await db
        .from("jobs")
        .update({
          status: "in_progress",
          kinglancer_id: attempt.kinglancer_id,
          direct_request_status: null,
        })
        .eq("id", attempt.job_id)
        .eq("status", "open")
        .eq("direct_request_status", "accepted_pending_payment")
        .eq("invited_kinglancer_id", attempt.kinglancer_id)
        .select("id")
        .maybeSingle();

      if (reserveError) throw reserveError;
      if (!reservedJob) throw new Error("Direct request payment conflict");
    } else if (
      job.status !== "in_progress" ||
      job.kinglancer_id !== attempt.kinglancer_id
    ) {
      throw new Error("Direct request has already changed state");
    }
  }

  const { error: transactionError } = await db.from("transactions").insert({
    job_id: attempt.job_id,
    application_id: attempt.application_id,
    client_id: attempt.client_id,
    kinglancer_id: attempt.kinglancer_id,
    amount: attempt.amount,
    platform_fee_client: attempt.platform_fee_client,
    platform_fee_kinglancer: attempt.platform_fee_kinglancer,
    stripe_payment_intent_id: stripePaymentIntentId,
    status: "held",
  });

  if (transactionError) {
    // 23505 = unique constraint violation on transactions_job_id_unique.
    // A concurrent webhook delivery already inserted this transaction.
    // Treat as idempotent success so Stripe stops retrying.
    if (transactionError.code === "23505") {
      await updatePaymentAttemptStatus(
        stripePaymentIntentId,
        "succeeded",
      ).catch(() => {});
      return { attempt, finalizedNow: false };
    }
    throw transactionError;
  }

  await updatePaymentAttemptStatus(stripePaymentIntentId, "succeeded");

  return { attempt, finalizedNow: true };
}
