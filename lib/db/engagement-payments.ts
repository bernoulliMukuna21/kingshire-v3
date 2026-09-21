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
    .eq("status", "due")
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getHeldEngagementPayments(): Promise<EngagementPaymentRow[]> {
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
  const { data, error } = await db
    .from("engagement_payments")
    .upsert(inputs, { onConflict: "engagement_id,period_index" })
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
): Promise<EngagementPaymentRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_payments")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "due")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
