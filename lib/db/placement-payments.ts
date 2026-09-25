import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { coerceNumeric, coerceNumericList } from "@/lib/db/coerce";
import {
  createEngagement,
  getEngagementsByIds,
  getEngagementBySource,
} from "@/lib/db/engagements";
import type { Engagement } from "@/lib/db/engagements";
import {
  createEngagementPayments,
  getEngagementPayment,
  getEngagementPayments,
  getDueEngagementPayments,
  updateEngagementPaymentStatus,
  getDisputedEngagementPayments,
  getHeldEngagementPaymentsForOrganisation,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import { periodFees } from "@/lib/settlement/fees";
import { dateOnly, periodDueDate } from "@/lib/settlement/schedule";
import { settleEngagementPaymentsOnEarlyEnd } from "@/lib/settlement/termination";
import { placementMonthlyAmounts, monthlyPaymentCount } from "@/lib/placements";
import type { PlacementAgreementRow } from "@/lib/db/placements";
import type { EngagementPaymentStatus } from "@/lib/settlement/types";

export type PlacementPaymentRow =
  Database["public"]["Tables"]["placement_payments"]["Row"];
const NUMERIC = ["amount", "platform_fee_client", "platform_fee_kinglancer"] as const;

// `agreement_id` on the compat row is the real placement_agreements.id (the
// engagement's `source_id`), NOT the engagement's own id — callers (routes,
// action-centre links) key off the placement agreement, not the engagement.
function toPlacementPayment(
  payment: EngagementPaymentRow,
  agreementId: string,
): PlacementPaymentRow {
  return {
    id: payment.id,
    agreement_id: agreementId,
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

/** Keeps only payments whose engagement is a Placement (not an org_role),
 * returning each alongside its engagement so callers get the real agreement id. */
async function onlyPlacementPayments(
  payments: EngagementPaymentRow[],
): Promise<{ payment: EngagementPaymentRow; engagement: Engagement }[]> {
  const engagementsById = await getEngagementsByIds(
    payments.map((payment) => payment.engagement_id),
  );
  const out: { payment: EngagementPaymentRow; engagement: Engagement }[] = [];
  for (const payment of payments) {
    const engagement = engagementsById.get(payment.engagement_id);
    if (engagement?.source_kind === "placement") {
      out.push({ payment, engagement });
    }
  }
  return out;
}

export async function listPlacementPayments(
  agreementId: string,
): Promise<PlacementPaymentRow[]> {
  const engagement = await findPlacementEngagement(agreementId);
  if (!engagement) return [];
  const payments = await getEngagementPayments(engagement.id);
  return coerceNumericList(
    payments.map((payment) => toPlacementPayment(payment, agreementId)),
    NUMERIC,
  );
}

export async function getPlacementPayment(
  paymentId: string,
): Promise<PlacementPaymentRow | null> {
  const payment = await getEngagementPayment(paymentId);
  if (!payment) return null;
  const engagementsById = await getEngagementsByIds([payment.engagement_id]);
  const engagement = engagementsById.get(payment.engagement_id);
  if (!engagement) return null;
  return coerceNumeric(
    toPlacementPayment(payment, engagement.source_id),
    NUMERIC,
  );
}

export async function ensurePaymentSchedule(
  agreement: PlacementAgreementRow,
  // The caller usually hasn't persisted kinglancer_signed_at on `agreement`
  // yet (it records it in a separate write) — pass it explicitly so the
  // schedule anchors on acceptance, not on the stale org_signed_at fallback.
  signedAt?: string,
): Promise<PlacementPaymentRow[]> {
  if (agreement.payment_mode !== "managed" || !agreement.monthly_amount) {
    return listPlacementPayments(agreement.id);
  }

  const kinglancerSignedAt = signedAt ?? agreement.kinglancer_signed_at;

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
      // A placement has a fixed term — bounding it stops the shared charge
      // cron from rolling it forward as if it were open-ended.
      duration_periods: monthlyPaymentCount(agreement.duration_weeks),
      status: "pending_funding",
      org_signed_by: agreement.org_signed_by,
      org_signed_at: agreement.org_signed_at,
      kinglancer_signed_at: kinglancerSignedAt,
    });
  }

  const existing = await getEngagementPayments(engagement.id);
  if (existing.length === 0) {
    const amounts = placementMonthlyAmounts(
      agreement.duration_weeks,
      Number(agreement.monthly_amount),
    );
    const anchor = new Date(
      kinglancerSignedAt ?? agreement.org_signed_at ?? new Date(),
    );
    await createEngagementPayments(
      amounts.map((amount, index) => {
        // Fees are computed from THIS period's own amount, not the full
        // monthly rate — otherwise a prorated final period's fee wouldn't
        // match its (smaller) amount.
        const fee = periodFees({ amountPerPeriod: amount, mode: "managed" });
        return {
          engagement_id: engagement!.id,
          organisation_id: agreement.organisation_id,
          kinglancer_id: agreement.kinglancer_id,
          period_index: index + 1,
          due_date: dateOnly(periodDueDate(anchor, "monthly", index + 1)),
          worker_amount: amount,
          platform_fee_client: fee.platformFeeClient,
          platform_fee_kinglancer: fee.platformFeeKinglancer,
          status: "due",
        };
      }),
    );
  }
  return listPlacementPayments(agreement.id);
}

export async function listDuePlacementPayments(): Promise<
  PlacementPaymentRow[]
> {
  const payments = await getDueEngagementPayments(
    new Date().toISOString().slice(0, 10),
  );
  const placementPayments = await onlyPlacementPayments(payments);
  return coerceNumericList(
    placementPayments.map(({ payment, engagement }) =>
      toPlacementPayment(payment, engagement.source_id),
    ),
    NUMERIC,
  );
}

export type DisputedPlacementPayment = PlacementPaymentRow & {
  organisation: { name: string } | null;
  kinglancer: { full_name: string | null } | null;
  agreement: { placement: { title: string } | null } | null;
};

type AgreementContext = {
  id: string;
  organisationName: string | null;
  placementTitle: string | null;
};

/** Batch-fetches placement title + organisation name for a set of agreement ids. */
async function getAgreementContexts(
  agreementIds: string[],
): Promise<Map<string, AgreementContext>> {
  if (agreementIds.length === 0) return new Map();
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_agreements")
    .select(
      "id, organisation:organisations!organisation_id(name), placement:placements!placement_id(title)",
    )
    .in("id", [...new Set(agreementIds)]);
  if (error) throw error;
  // PostgREST returns the joined relation as an object or an array depending
  // on inferred cardinality — normalise both shapes defensively.
  const first = <T>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;
  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        organisationName:
          first(row.organisation as { name: string } | { name: string }[] | null)
            ?.name ?? null,
        placementTitle:
          first(row.placement as { title: string } | { title: string }[] | null)
            ?.title ?? null,
      },
    ]),
  );
}

async function getKinglancerNames(
  kinglancerIds: string[],
): Promise<Map<string, string | null>> {
  if (kinglancerIds.length === 0) return new Map();
  const db = createServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(kinglancerIds)]);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
}

export async function listDisputedPlacementPayments(): Promise<
  DisputedPlacementPayment[]
> {
  const payments = await getDisputedEngagementPayments();
  const placementPayments = await onlyPlacementPayments(payments);
  const [agreementContexts, kinglancerNames] = await Promise.all([
    getAgreementContexts(
      placementPayments.map(({ engagement }) => engagement.source_id),
    ),
    getKinglancerNames(
      placementPayments.map(({ payment }) => payment.kinglancer_id),
    ),
  ]);

  return placementPayments.map(({ payment, engagement }) => {
    const context = agreementContexts.get(engagement.source_id);
    return {
      ...toPlacementPayment(payment, engagement.source_id),
      organisation: context?.organisationName
        ? { name: context.organisationName }
        : null,
      kinglancer: {
        full_name: kinglancerNames.get(payment.kinglancer_id) ?? null,
      },
      agreement: context?.placementTitle
        ? { placement: { title: context.placementTitle } }
        : null,
    };
  });
}

export type OrgHeldPlacementPayment = PlacementPaymentRow & {
  kinglancer: { full_name: string | null } | null;
  agreement: { placement: { title: string } | null } | null;
};

export async function listHeldPlacementPaymentsForOrg(
  organisationId: string,
): Promise<OrgHeldPlacementPayment[]> {
  const payments = await getHeldEngagementPaymentsForOrganisation(organisationId);
  const placementPayments = await onlyPlacementPayments(payments);
  const [agreementContexts, kinglancerNames] = await Promise.all([
    getAgreementContexts(
      placementPayments.map(({ engagement }) => engagement.source_id),
    ),
    getKinglancerNames(
      placementPayments.map(({ payment }) => payment.kinglancer_id),
    ),
  ]);

  return placementPayments.map(({ payment, engagement }) => {
    const context = agreementContexts.get(engagement.source_id);
    return {
      ...toPlacementPayment(payment, engagement.source_id),
      kinglancer: {
        full_name: kinglancerNames.get(payment.kinglancer_id) ?? null,
      },
      agreement: context?.placementTitle
        ? { placement: { title: context.placementTitle } }
        : null,
    };
  });
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
      | "notice_sent_at"
      | "dispute_reason"
    >
  >,
): Promise<void> {
  await updateEngagementPaymentStatus(
    paymentId,
    (patch.status ?? "due") as EngagementPaymentStatus,
    {
      ...(patch.stripe_payment_intent_id !== undefined
        ? { stripe_payment_intent_id: patch.stripe_payment_intent_id }
        : {}),
      ...(patch.stripe_transfer_id !== undefined
        ? { stripe_transfer_id: patch.stripe_transfer_id }
        : {}),
      ...(patch.paid_at !== undefined ? { charged_at: patch.paid_at } : {}),
      ...(patch.released_at !== undefined
        ? { released_at: patch.released_at }
        : {}),
      ...(patch.notice_sent_at !== undefined
        ? { notice_sent_at: patch.notice_sent_at }
        : {}),
      ...(patch.dispute_reason !== undefined
        ? { dispute_reason: patch.dispute_reason }
        : {}),
    },
  );
}

export async function settlePlacementPaymentsOnEarlyEnd(
  agreementId: string,
  reason: string,
): Promise<void> {
  const engagement = await findPlacementEngagement(agreementId);
  if (!engagement) return;
  await settleEngagementPaymentsOnEarlyEnd(engagement.id, reason);
}
