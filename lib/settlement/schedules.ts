import {
  createEngagementPayments,
  getEngagementPayments,
} from "@/lib/db/engagement-payments";
import { getEngagement } from "@/lib/db/engagements";
import { periodDueDate, plannedPeriodIndexes } from "./schedule";
import { MIN_PERIOD_AMOUNT_GBP, periodFees } from "./fees";
import type { Cadence } from "./types";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ScheduleResult = {
  created: number;
  paymentIds: string[];
};

/**
 * Create missing periods without changing existing ledger rows. Bounded
 * engagements receive every remaining period; open-ended engagements receive
 * one rolling period by default and are topped up by the charge worker.
 */
export async function ensureEngagementSchedule(
  engagementId: string,
  anchorDate = new Date(),
  rollingCount = 1,
): Promise<ScheduleResult> {
  const engagement = await getEngagement(engagementId);
  if (!engagement) throw new Error("Engagement not found");
  if (engagement.amount_per_period == null) {
    throw new Error("Engagement amount is not agreed");
  }

  const existing = await getEngagementPayments(engagementId);
  const existingIndexes = new Set(existing.map((payment) => payment.period_index));
  const lastIndex = existing.reduce(
    (max, payment) => Math.max(max, payment.period_index),
    0,
  );
  const indexes = plannedPeriodIndexes({
    durationPeriods: engagement.duration_periods,
    fromIndex: lastIndex + 1,
    rollingCount,
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
