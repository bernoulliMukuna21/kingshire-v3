import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { calculateFees } from "@/lib/stripe";
import { monthlyPaymentCount } from "@/lib/placements";
import type { PlacementAgreementRow } from "@/lib/db/placements";

export type PlacementPaymentRow =
  Database["public"]["Tables"]["placement_payments"]["Row"];

/** Adds whole calendar months to a date. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function listPlacementPayments(
  agreementId: string,
): Promise<PlacementPaymentRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_payments")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("period_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlacementPaymentRow[];
}

export async function getPlacementPayment(
  paymentId: string,
): Promise<PlacementPaymentRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  return (data as PlacementPaymentRow | null) ?? null;
}

/**
 * Creates the monthly payment rows for a managed agreement if they don't
 * exist yet. Idempotent — safe to call on every render. Returns the ledger.
 */
export async function ensurePaymentSchedule(
  agreement: PlacementAgreementRow,
): Promise<PlacementPaymentRow[]> {
  const existing = await listPlacementPayments(agreement.id);
  if (existing.length > 0) return existing;
  if (agreement.payment_mode !== "managed" || !agreement.monthly_amount) {
    return existing;
  }

  const amount = Number(agreement.monthly_amount);
  const { platformFeeClient, platformFeeKinglancer } = calculateFees(amount);
  const months = monthlyPaymentCount(agreement.duration_weeks);
  const anchor = new Date();
  const rows = Array.from({ length: months }, (_, i) => ({
    agreement_id: agreement.id,
    organisation_id: agreement.organisation_id,
    kinglancer_id: agreement.kinglancer_id,
    period_index: i + 1,
    due_date: addMonths(anchor, i).toISOString().slice(0, 10),
    amount,
    platform_fee_client: platformFeeClient,
    platform_fee_kinglancer: platformFeeKinglancer,
    status: "due" as const,
  }));

  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_payments")
    .insert(rows)
    .select();
  if (error) {
    // A concurrent render may have inserted first (unique agreement+period).
    return listPlacementPayments(agreement.id);
  }
  return (data ?? []) as PlacementPaymentRow[];
}

/** Due, unpaid managed payments whose due date has arrived, for active
 * agreements only. Used by the monthly auto-charge cron. */
export async function listDuePlacementPayments(): Promise<
  PlacementPaymentRow[]
> {
  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("placement_payments")
    .select("*, agreement:placement_agreements!agreement_id(status)")
    .eq("status", "due")
    .lte("due_date", today);
  if (error) throw error;
  const rows = (data ?? []) as (PlacementPaymentRow & {
    agreement: { status: string } | null;
  })[];
  return rows.filter(
    (row) => row.agreement?.status === "active",
  ) as unknown as PlacementPaymentRow[];
}

export async function updatePlacementPaymentStatus(
  paymentId: string,
  patch: Partial<
    Pick<
      Database["public"]["Tables"]["placement_payments"]["Update"],
      | "status"
      | "stripe_payment_intent_id"
      | "stripe_transfer_id"
      | "paid_at"
      | "released_at"
    >
  >,
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("placement_payments")
    .update(patch)
    .eq("id", paymentId);
  if (error) throw error;
}
