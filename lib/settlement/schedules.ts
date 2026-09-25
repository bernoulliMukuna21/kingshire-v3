import {
  createEngagementPayments,
  getEngagementPayments,
} from "@/lib/db/engagement-payments";
import { getEngagement } from "@/lib/db/engagements";
import { dateOnly, periodDueDate, plannedPeriodIndexes } from "./schedule";
import { MIN_PERIOD_AMOUNT_GBP, periodFees } from "./fees";
import type { Cadence } from "./types";

export type ScheduleResult = {
  created: number;
  paymentIds: string[];
};

/**
 * Create missing periods without changing existing ledger rows. Bounded
 * engagements receive every remaining period; open-ended engagements receive
 * periods through an explicit target (period 1 by default).
 *
 * The anchor is always derived from the engagement's own acceptance date
 * (falling back to when it was created), never from "now" — callers used to
 * default the anchor to the call time, so a late cron run or a retried charge
 * would silently shift every subsequent period's due date forward.
 */
export async function ensureEngagementSchedule(
  engagementId: string,
  throughPeriod = 1,
): Promise<ScheduleResult> {
  const engagement = await getEngagement(engagementId);
  if (!engagement) throw new Error("Engagement not found");
  if (engagement.amount_per_period == null) {
    throw new Error("Engagement amount is not agreed");
  }
  const anchorDate = new Date(
    engagement.kinglancer_signed_at ?? engagement.created_at,
  );

  const existing = await getEngagementPayments(engagementId);
  const existingIndexes = new Set(
    existing.map((payment) => payment.period_index),
  );
  if (engagement.status === "ended" || engagement.status === "cancelled") {
    return { created: 0, paymentIds: [] };
  }
  // An explicit target makes retries and competing webhook/cron calls converge.
  // Acceptance requests period 1; fulfilment of period N requests N + 1.
  const indexes = plannedPeriodIndexes({
    durationPeriods: engagement.duration_periods,
    fromIndex: 1,
    rollingCount: throughPeriod,
  }).filter((index) => !existingIndexes.has(index));

  const fee = periodFees({
    amountPerPeriod: Number(engagement.amount_per_period),
    mode: engagement.settlement_mode,
  });
  if (fee.orgChargeGBP < MIN_PERIOD_AMOUNT_GBP) {
    throw new Error("Recurring settlement charge must be at least £10");
  }
  const inputs = indexes.map((periodIndex) => ({
    engagement_id: engagement.id,
    organisation_id: engagement.organisation_id,
    kinglancer_id: engagement.kinglancer_id,
    period_index: periodIndex,
    due_date: dateOnly(
      periodDueDate(anchorDate, engagement.cadence as Cadence, periodIndex),
    ),
    worker_amount: fee.workerAmount,
    platform_fee_client: fee.platformFeeClient,
    platform_fee_kinglancer: fee.platformFeeKinglancer,
    status: "due" as const,
  }));

  const created = await createEngagementPayments(inputs);
  return {
    created: created.length,
    paymentIds: created.map((payment) => payment.id),
  };
}
