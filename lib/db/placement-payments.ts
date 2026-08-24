import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { calculateFees } from "@/lib/stripe";
import { monthlyPaymentCount } from "@/lib/placements";
import type { PlacementAgreementRow } from "@/lib/db/placements";

export type PlacementPaymentRow =
  Database["public"]["Tables"]["placement_payments"]["Row"];

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
  const rows = Array.from({ length: months }, (_, i) => ({
    agreement_id: agreement.id,
    organisation_id: agreement.organisation_id,
    kinglancer_id: agreement.kinglancer_id,
    period_index: i + 1,
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
