import type { Database } from "@/lib/supabase/types";
import { coerceNumeric, coerceNumericList } from "@/lib/db/coerce";
import { createEngagement, getEngagement, getEngagementBySource } from "@/lib/db/engagements";
import {
  createEngagementPayments,
  getEngagementPayment,
  getEngagementPayments,
  getDueEngagementPayments,
  updateEngagementPaymentStatus,
  getDisputedEngagementPayments,
  getHeldEngagementPaymentsForOrganisation,
} from "@/lib/db/engagement-payments";
import { periodFees } from "@/lib/settlement/fees";
import { placementMonthlyAmounts } from "@/lib/placements";
import type { PlacementAgreementRow } from "@/lib/db/placements";
import type { EngagementPaymentStatus } from "@/lib/settlement/types";

export type PlacementPaymentRow =
  Database["public"]["Tables"]["placement_payments"]["Row"];
const NUMERIC = ["amount", "platform_fee_client", "platform_fee_kinglancer"] as const;

type SharedPayment = NonNullable<Awaited<ReturnType<typeof getEngagementPayment>>> & {
  engagement_id: string;
};

function toPlacementPayment(payment: SharedPayment | null): PlacementPaymentRow | null {
  if (!payment) return null;
  return {
    id: payment.id,
    agreement_id: payment.engagement_id,
    organisation_id: payment.organisation_id,
    kinglancer_id: payment.kinglancer_id,
    period_index: payment.period_index,
    due_date: payment.due_date,
    amount: payment.worker_amount,
    platform_fee_client: payment.platform_fee_client,
    platform_fee_kinglancer: payment.platform_fee_kinglancer,
    status: payment.status,
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_transfer_id: payment.stripe_transfer_id,
    paid_at: payment.charged_at,
    released_at: payment.released_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    notice_sent_at: payment.notice_sent_at,
    dispute_reason: payment.dispute_reason,
  } as PlacementPaymentRow;
}

async function findPlacementEngagement(agreementId: string) {
  return getEngagementBySource("placement", agreementId);
}

export async function listPlacementPayments(agreementId: string): Promise<PlacementPaymentRow[]> {
  const engagement = await findPlacementEngagement(agreementId);
  if (!engagement) return [];
  const payments = await getEngagementPayments(engagement.id);
  return coerceNumericList(
    payments.map((payment) => toPlacementPayment({ ...payment, engagement_id: engagement.id })!),
    NUMERIC,
  );
}

export async function getPlacementPayment(paymentId: string): Promise<PlacementPaymentRow | null> {
  const payment = await getEngagementPayment(paymentId);
  return payment
    ? coerceNumeric(
        toPlacementPayment({ ...payment, engagement_id: payment.engagement_id }) as PlacementPaymentRow,
        NUMERIC,
      )
    : null;
}

export async function ensurePaymentSchedule(agreement: PlacementAgreementRow): Promise<PlacementPaymentRow[]> {
  if (agreement.payment_mode !== "managed" || !agreement.monthly_amount) {
    return listPlacementPayments(agreement.id);
  }

  let engagement = await findPlacementEngagement(agreement.id);
  if (!engagement) {
    engagement = await createEngagement({
      source_kind: "placement",
      source_id: agreement.id,
      organisation_id: agreement.organisation_id,
      kinglancer_id: agreement.kinglancer_id,
      settlement_mode: "managed",
      cadence: "monthly",
      amount_per_period: Number(agreement.monthly_amount),
      duration_periods: null,
      status: "pending_funding",
      org_signed_by: agreement.org_signed_by,
      org_signed_at: agreement.org_signed_at,
      kinglancer_signed_at: agreement.kinglancer_signed_at,
    });
  }

  const existing = await getEngagementPayments(engagement.id);
  if (existing.length === 0) {
    const amounts = placementMonthlyAmounts(
      agreement.duration_weeks,
      Number(agreement.monthly_amount),
    );
    const fees = periodFees({
      amountPerPeriod: Number(agreement.monthly_amount),
      mode: "managed",
    });
    await createEngagementPayments(
      amounts.map((amount, index) => ({
        engagement_id: engagement!.id,
        organisation_id: agreement.organisation_id,
        kinglancer_id: agreement.kinglancer_id,
        period_index: index + 1,
        due_date: new Date(
          new Date().setUTCMonth(new Date().getUTCMonth() + index),
        ).toISOString().slice(0, 10),
        worker_amount: amount,
        platform_fee_client: fees.platformFeeClient,
        platform_fee_kinglancer: fees.platformFeeKinglancer,
        status: "due",
      })),
    );
  }
  return listPlacementPayments(agreement.id);
}

export async function listDuePlacementPayments(): Promise<PlacementPaymentRow[]> {
  const payments = await getDueEngagementPayments(new Date().toISOString().slice(0, 10));
  const placementPayments = [];
  for (const payment of payments) {
    const engagement = await getEngagement(payment.engagement_id);
    if (engagement?.source_kind === "placement") placementPayments.push(payment);
  }
  return coerceNumericList(
    placementPayments.map((payment) => toPlacementPayment({ ...payment, engagement_id: payment.engagement_id })!).filter(Boolean),
    NUMERIC,
  );
}

export type DisputedPlacementPayment = PlacementPaymentRow & {
  organisation: { name: string } | null;
  kinglancer: { full_name: string | null } | null;
  agreement: { placement: { title: string } | null } | null;
};

export async function listDisputedPlacementPayments(): Promise<DisputedPlacementPayment[]> {
  const payments = await getDisputedEngagementPayments();
  const placementPayments = [];
  for (const payment of payments) {
    const engagement = await getEngagement(payment.engagement_id);
    if (engagement?.source_kind === "placement") placementPayments.push(payment);
  }
  return placementPayments.map((payment) => toPlacementPayment({ ...payment, engagement_id: payment.engagement_id })!) as unknown as DisputedPlacementPayment[];
}

export type OrgHeldPlacementPayment = PlacementPaymentRow & {
  kinglancer: { full_name: string | null } | null;
  agreement: { placement: { title: string } | null } | null;
};

export async function listHeldPlacementPaymentsForOrg(organisationId: string): Promise<OrgHeldPlacementPayment[]> {
  const payments = await getHeldEngagementPaymentsForOrganisation(organisationId);
  const placementPayments = [];
  for (const payment of payments) {
    const engagement = await getEngagement(payment.engagement_id);
    if (engagement?.source_kind === "placement") placementPayments.push(payment);
  }
  return placementPayments.map((payment) => toPlacementPayment({ ...payment, engagement_id: payment.engagement_id })!) as unknown as OrgHeldPlacementPayment[];
}

export async function updatePlacementPaymentStatus(
  paymentId: string,
  patch: Partial<Pick<Database["public"]["Tables"]["placement_payments"]["Update"], "status" | "stripe_payment_intent_id" | "stripe_transfer_id" | "paid_at" | "released_at" | "notice_sent_at" | "dispute_reason">>,
): Promise<void> {
  await updateEngagementPaymentStatus(paymentId, (patch.status ?? "due") as EngagementPaymentStatus, {
    ...(patch.stripe_payment_intent_id !== undefined ? { stripe_payment_intent_id: patch.stripe_payment_intent_id } : {}),
    ...(patch.stripe_transfer_id !== undefined ? { stripe_transfer_id: patch.stripe_transfer_id } : {}),
    ...(patch.paid_at !== undefined ? { charged_at: patch.paid_at } : {}),
    ...(patch.released_at !== undefined ? { released_at: patch.released_at } : {}),
    ...(patch.notice_sent_at !== undefined ? { notice_sent_at: patch.notice_sent_at } : {}),
    ...(patch.dispute_reason !== undefined ? { dispute_reason: patch.dispute_reason } : {}),
  });
}

export async function settlePlacementPaymentsOnEarlyEnd(agreementId: string, reason: string): Promise<void> {
  const engagement = await findPlacementEngagement(agreementId);
  if (!engagement) return;
  const payments = await getEngagementPayments(engagement.id);
  await Promise.all(
    payments.map((payment) =>
      payment.status === "due"
        ? updateEngagementPaymentStatus(payment.id, "cancelled")
        : payment.status === "held"
          ? updateEngagementPaymentStatus(payment.id, "disputed", { dispute_reason: reason })
          : Promise.resolve(null),
    ),
  );
}
