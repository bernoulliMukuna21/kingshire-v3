import { ApplicantSelectionConflictError } from "@/lib/db/applications";
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

  // Atomic finalization: one locked Postgres transaction reserves the job,
  // selects/rejects applicants, inserts the unique escrow transaction and marks
  // the attempt succeeded. See migration 033.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("finalize_payment_attempt", {
    p_payment_intent_id: stripePaymentIntentId,
  });

  if (error) throw error;

  const payload = data as {
    result: string;
    attempt: PaymentAttemptRow | null;
  };
  const attempt = payload.attempt;

  switch (payload.result) {
    case "finalized":
      return { attempt, finalizedNow: true };
    case "already_finalized":
    case "legacy_no_attempt":
      return { attempt, finalizedNow: false };
    case "different_payment":
      throw new Error("A different payment has already funded this job");
    case "unauthorised":
      throw new Error("Payment attempt payer is not authorised for this job");
    case "applicant_conflict":
      throw new ApplicantSelectionConflictError();
    case "direct_not_ready":
      throw new Error("Direct request is no longer ready for payment");
    case "direct_conflict":
      throw new Error("Direct request payment conflict");
    case "direct_changed":
      throw new Error("Direct request has already changed state");
    case "application_missing_id":
      throw new Error("Application payment attempt is missing application_id");
    case "job_not_found":
      throw new Error("Job not found for payment attempt");
    default:
      throw new Error(`Unexpected finalize result: ${String(payload.result)}`);
  }
}
