import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export type SettlementLedger = "transactions" | "engagement_payments";
const metadata = z.record(z.string(), z.string());
const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transfer"),
    params: z.object({
      amount: z.number().int().positive(),
      currency: z.literal("gbp"),
      destination: z.string().min(1),
      source_transaction: z.string().optional(),
      metadata,
    }),
  }),
  z.object({
    kind: z.literal("refund"),
    params: z.object({ payment_intent: z.string().min(1), metadata }),
  }),
]);
export type SettlementRequest = z.infer<typeof requestSchema>;

/** Only a documented, definitive rejection can make a dispatched request resettable. */
export function confirmedSettlementFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    type?: string;
    code?: string;
    statusCode?: number;
    requestId?: string;
  };
  return (
    e.type === "StripeInvalidRequestError" &&
    e.code === "balance_insufficient" &&
    e.statusCode === 400 &&
    !!e.requestId
  );
}

async function execute(
  ledger: SettlementLedger,
  id: string,
  attempt: string,
  request: SettlementRequest,
  key: string,
) {
  const db = createServiceClient();
  // Keep external failure classification separate from failures saving its result.
  let result;
  try {
    result =
      request.kind === "transfer"
        ? await stripe.transfers.create(request.params, { idempotencyKey: key })
        : await stripe.refunds.create(request.params, { idempotencyKey: key });
  } catch (error) {
    const { error: saveError } = await db
      .from(ledger)
      .update({
        settlement_error: confirmedSettlementFailure(error)
          ? "Stripe confirmed insufficient balance; safe reset available"
          : "External outcome requires reconciliation",
        ...(confirmedSettlementFailure(error)
          ? {
              release_outcome: "failed",
              release_failure_code: "balance_insufficient",
            }
          : {}),
      })
      .eq("id", id)
      .eq("release_attempt_id", attempt)
      .eq("release_outcome", "dispatched");
    if (saveError)
      console.error(
        "[settlement] could not persist failure classification",
        saveError,
      );
    throw error;
  }
  const complete =
    request.kind === "transfer" ||
    ("status" in result && result.status === "succeeded");
  const { data, error } = await db
    .from(ledger)
    .update({
      ...(request.kind === "transfer"
        ? { stripe_transfer_id: result.id }
        : { stripe_refund_id: result.id }),
      release_outcome: complete ? "confirmed" : "pending",
      settlement_error: complete
        ? null
        : "Refund outcome pending reconciliation",
    })
    .eq("id", id)
    .eq("release_attempt_id", attempt)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("Reservation changed; reconcile the external result");
  if (!complete) throw new Error("Refund is pending reconciliation");
  return result;
}

/** CAS fences an old worker after an admin resets a not-yet-dispatched attempt. */
export async function dispatchSettlement(
  ledger: SettlementLedger,
  id: string,
  attempt: string,
  input: SettlementRequest,
) {
  const request = requestSchema.parse(input);
  const key = `settlement-${ledger}-${attempt}`;
  const { data, error } = await createServiceClient()
    .from(ledger)
    .update({
      release_request: request,
      release_dispatch_started_at: new Date().toISOString(),
      release_idempotency_key: key,
      release_outcome: "dispatched",
    })
    .eq("id", id)
    .eq("release_attempt_id", attempt)
    .eq("release_outcome", "reserved")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Settlement attempt changed; nothing dispatched");
  return execute(ledger, id, attempt, request, key);
}

/** Replay exactly the saved request inside Stripe's retention window; never create a new key. */
export async function retrySettlement(
  ledger: SettlementLedger,
  id: string,
  expectedAttempt: string,
) {
  const { data: row, error } = await createServiceClient()
    .from(ledger)
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (
    !row ||
    row.release_attempt_id !== expectedAttempt ||
    !row.release_dispatch_started_at ||
    !row.release_idempotency_key ||
    !["dispatched", "confirmed", "pending"].includes(row.release_outcome ?? "")
  ) {
    throw new Error("No matching dispatched request to retry");
  }
  const age = Date.now() - new Date(row.release_dispatch_started_at).getTime();
  if (age < 0 || age >= 20 * 60 * 60 * 1000)
    throw new Error(
      "Retry window closed; verify the existing Stripe outcome instead",
    );
  const result = await execute(
    ledger,
    id,
    expectedAttempt,
    requestSchema.parse(row.release_request),
    row.release_idempotency_key,
  );
  return result.id;
}
