import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export type { TransactionRow };

export async function createTransaction(data: TransactionInsert) {
  const db = createServiceClient();
  const { data: tx, error } = await db
    .from("transactions")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return tx as TransactionRow;
}

export async function getTransactionByJob(jobId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transactions")
    .select("*")
    .eq("job_id", jobId)
    .single();
  if (error) return null;
  return data as TransactionRow;
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
  return data as TransactionRow | null;
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
