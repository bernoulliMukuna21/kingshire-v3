import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { EngagementPaymentStatus } from "@/lib/settlement/types";

export type EngagementPaymentRow =
  Database["public"]["Tables"]["engagement_payments"]["Row"];
export type EngagementPaymentInsert =
  Database["public"]["Tables"]["engagement_payments"]["Insert"];

export async function getEngagementPayment(
  id: string,
): Promise<EngagementPaymentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getEngagementPayments(
  engagementId: string,
): Promise<EngagementPaymentRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("period_index", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getDueEngagementPayments(
  today: string,
): Promise<EngagementPaymentRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    // "failed" is retried alongside "due" — a card issue today shouldn't
    // permanently strand a period with no further attempt.
    .in("status", ["due", "failed"])
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getHeldEngagementPayments(): Promise<
  EngagementPaymentRow[]
> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("status", "held")
    .is("stripe_transfer_id", null)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getHeldEngagementPaymentsForOrganisation(
  organisationId: string,
): Promise<EngagementPaymentRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("status", "held")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDisputedEngagementPayments(): Promise<
  EngagementPaymentRow[]
> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("status", "disputed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createEngagementPayment(
  input: EngagementPaymentInsert,
): Promise<EngagementPaymentRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createEngagementPayments(
  inputs: EngagementPaymentInsert[],
): Promise<EngagementPaymentRow[]> {
  if (inputs.length === 0) return [];
  const db = createServiceClient();
  // Insert-only: a row that already exists for this engagement/period is left
  // untouched. Without `ignoreDuplicates`, upsert would overwrite an
  // in-flight/settled row back to "due" under concurrent scheduling.
  const { data, error } = await db
    .from("engagement_payments")
    .upsert(inputs, {
      onConflict: "engagement_id,period_index",
      ignoreDuplicates: true,
    })
    .select("*");

  if (error) throw error;
  return data ?? [];
}

export async function updateEngagementPaymentStatus(
  id: string,
  status: EngagementPaymentStatus,
  patch: Partial<
    Database["public"]["Tables"]["engagement_payments"]["Update"]
  > = {},
): Promise<EngagementPaymentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .update({ status, ...patch })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function reserveEngagementPayment(
  id: string,
  kind: "checkout" | "automatic",
  context?: { customerId: string; paymentMethodId: string },
): Promise<EngagementPaymentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .update({
      status: "processing",
      attempt_id: crypto.randomUUID(),
      attempt_kind: kind,
      attempt_started_at: new Date().toISOString(),
      attempt_customer_id: context?.customerId ?? null,
      attempt_payment_method_id: context?.paymentMethodId ?? null,
    })
    .eq("id", id)
    .eq("status", "due")
    .is("attempt_id", null)
    .is("stripe_payment_intent_id", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Recovery scans durable state; never reset an uncertain Stripe attempt. */
export async function getRecoverablePayments(
  afterId?: string,
): Promise<EngagementPaymentRow[]> {
  let query = createServiceClient()
    .from("engagement_payments")
    .select("*")
    .is("fulfilled_at", null)
    .in("status", ["processing", "held", "released", "failed"])
    .order("id")
    .limit(100);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function patchPaymentAttempt(
  payment: EngagementPaymentRow,
  patch: Partial<EngagementPaymentInsert>,
): Promise<void> {
  let query = createServiceClient()
    .from("engagement_payments")
    .update(patch)
    .eq("id", payment.id);
  query = payment.attempt_id
    ? query.eq("attempt_id", payment.attempt_id)
    : query.is("attempt_id", null);
  const { error } = await query;
  if (error) throw error;
}
