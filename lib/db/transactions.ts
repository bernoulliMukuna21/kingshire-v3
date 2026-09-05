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

/**
 * Admin "record payout" — the manual equivalent of fireTransfer. Releases a
 * held escrow once the worker has been paid by hand. A held escrow on an
 * approved job is always a manual payout (Stripe payouts release the escrow).
 */
export async function recordManualPayout(
  jobId: string,
  opts: { reference: string; adminId: string },
) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transactions")
    .update({
      status: "released",
      released_at: new Date().toISOString(),
      payout_method: "manual",
      manual_payout_reference: opts.reference,
      confirmed_by: opts.adminId,
    })
    .eq("job_id", jobId)
    .eq("status", "held")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data
    ? coerceNumeric(data as TransactionRow, TRANSACTION_NUMERIC)
    : null;
}

export type ManualPayoutQueueItem = {
  jobId: string;
  jobTitle: string;
  organisationId: string | null;
  workerId: string;
  workerName: string | null;
  workerEmail: string | null;
  payoutProvider: string | null;
  payoutLink: string | null;
  reference: string;
  netAmount: number;
  createdAt: string;
};

/**
 * Admin "Awaiting payout" queue — held escrow whose job the client has already
 * approved, so we owe the worker a manual payout. This is any held transaction
 * on an approved job: Stripe payouts move the escrow to 'released', so a held
 * row on an approved job is always awaiting a manual payout (bank-transfer
 * jobs, or card-funded jobs for workers without a Stripe-payout subscription).
 * Each item carries the worker's payout link (where the admin sends the money).
 */
export async function getManualPayoutQueue(): Promise<ManualPayoutQueueItem[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transactions")
    .select(
      `job_id, kinglancer_id, amount, platform_fee_kinglancer, created_at,
       job:jobs!job_id(title, status, organisation_id),
       worker:profiles!kinglancer_id(full_name, email)`,
    )
    .eq("status", "held")
    .order("created_at", { ascending: true });
  if (error) throw error;

  type Row = {
    job_id: string;
    kinglancer_id: string;
    amount: number | string;
    platform_fee_kinglancer: number | string;
    created_at: string;
    job: {
      title: string;
      status: string;
      organisation_id: string | null;
    } | null;
    worker: { full_name: string | null; email: string | null } | null;
  };

  const items = ((data ?? []) as unknown as Row[])
    .filter((r) => r.job?.status === "approved")
    .map((r) => ({
      jobId: r.job_id,
      jobTitle: r.job?.title ?? "Job",
      organisationId: r.job?.organisation_id ?? null,
      workerId: r.kinglancer_id,
      workerName: r.worker?.full_name ?? null,
      workerEmail: r.worker?.email ?? null,
      payoutProvider: null as string | null,
      payoutLink: null as string | null,
      reference: r.job_id.slice(0, 8),
      netAmount: Number(r.amount) - Number(r.platform_fee_kinglancer),
      createdAt: r.created_at,
    }));

  if (items.length > 0) {
    const [accountsRes, attemptsRes] = await Promise.all([
      db
        .from("payout_accounts")
        .select("user_id, payout_provider, payout_link")
        .in(
          "user_id",
          items.map((i) => i.workerId),
        ),
      // The original inbound reference the client used — reused for the payout
      // so one reference ties the whole flow together.
      db
        .from("payment_attempts")
        .select("id, job_id")
        .in(
          "job_id",
          items.map((i) => i.jobId),
        )
        .eq("method", "bank_transfer")
        .eq("status", "succeeded"),
    ]);
    const byUser = new Map(
      (accountsRes.data ?? []).map((a) => [a.user_id, a] as const),
    );
    const refByJob = new Map(
      (attemptsRes.data ?? []).map((a) => [a.job_id, a.id] as const),
    );
    for (const item of items) {
      const acc = byUser.get(item.workerId);
      item.payoutProvider = acc?.payout_provider ?? null;
      item.payoutLink = acc?.payout_link ?? null;
      const ref = refByJob.get(item.jobId);
      if (ref) item.reference = ref.slice(0, 8);
    }
  }

  return items;
}
