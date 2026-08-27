import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { coerceNumeric } from "@/lib/db/coerce";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export type { TransactionRow };

// `numeric` columns arrive as strings — coerce so callers can do money math.
const TRANSACTION_NUMERIC = [
  "amount",
  "platform_fee_client",
  "platform_fee_kinglancer",
] as const;

export async function createTransaction(data: TransactionInsert) {
  const db = createServiceClient();
  const { data: tx, error } = await db
    .from("transactions")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return coerceNumeric(tx as TransactionRow, TRANSACTION_NUMERIC);
}

export async function getTransactionByJob(jobId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transactions")
    .select("*")
    .eq("job_id", jobId)
    .single();
  if (error) return null;
  return coerceNumeric(data as TransactionRow, TRANSACTION_NUMERIC);
}

export async function getTransactionByPaymentIntent(
  stripePaymentIntentId: string,
) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transactions")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle();
  if (error) return null;
  return data
    ? coerceNumeric(data as TransactionRow, TRANSACTION_NUMERIC)
    : null;
}

export async function updateTransactionStatus(
  stripePaymentIntentId: string,
  status: TransactionRow["status"],
  releasedAt?: string,
) {
  const db = createServiceClient();
  const update: Database["public"]["Tables"]["transactions"]["Update"] = {
    status,
    ...(releasedAt ? { released_at: releasedAt } : {}),
  };
  const { error } = await db
    .from("transactions")
    .update(update)
    .eq("stripe_payment_intent_id", stripePaymentIntentId);
  if (error) throw error;
}

export async function updateTransactionStatusByJobId(
  jobId: string,
  status: TransactionRow["status"],
  releasedAt?: string,
) {
  const db = createServiceClient();
  const update: Database["public"]["Tables"]["transactions"]["Update"] = {
    status,
    ...(releasedAt ? { released_at: releasedAt } : {}),
  };
  const { error } = await db
    .from("transactions")
    .update(update)
    .eq("job_id", jobId);
  if (error) throw error;
}
