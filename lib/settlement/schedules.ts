import {
  createEngagementPayments,
  getEngagementPayments,
} from "@/lib/db/engagement-payments";
import { getEngagement, type Engagement } from "@/lib/db/engagements";
import { getJobById } from "@/lib/db/jobs";
import {
  dateOnly,
  periodDueDate,
  plannedPeriodIndexes,
  roleBillingFractions,
} from "./schedule";
import { roleScheduleMeetsMinimumCharge } from "./role-schedule-policy";
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
 *
 * A temporary role is the one exception: its advertised start/end dates bound
 * billing exactly (anchored on the agreed start, not acceptance), including a
 * prorated final period, rather than an open period count that could bill
 * past — or stop short of — the dates the Kinglancer actually agreed to.
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
  if (engagement.status === "ended" || engagement.status === "cancelled") {
    return { created: 0, paymentIds: [] };
  }

  const existing = await getEngagementPayments(engagementId);
  const existingIndexes = new Set(
    existing.map((payment) => payment.period_index),
  );

  const job =
    engagement.source_kind === "org_role"
      ? await getJobById(engagement.source_id, { useServiceRole: true })
      : null;
  const isBoundedRole =
    job?.employment_type === "temporary" && !!job.scheduled_at && !!job.ends_at;

  if (isBoundedRole) {
    const anchorDate = new Date(job!.scheduled_at as string);
    const boundEnd = new Date(job!.ends_at as string);
    const cadence = engagement.cadence as Cadence;
    if (
      !roleScheduleMeetsMinimumCharge({
        anchor: anchorDate,
        boundEnd,
        cadence,
        amountPerPeriod: Number(engagement.amount_per_period),
        settlementMode: engagement.settlement_mode,
      })
    ) {
      throw new Error("Every prorated role payment must meet the minimum charge");
    }
    const fractions = roleBillingFractions(anchorDate, boundEnd, cadence);
    const inputs = fractions
      .map((fraction, i) => ({ periodIndex: i + 1, fraction }))
      .filter(({ periodIndex }) => !existingIndexes.has(periodIndex))
      .map(({ periodIndex, fraction }) => {
        // Each period's fee is derived from its OWN (possibly prorated)
        // amount, not the full rate — otherwise a partial final period's fee
        // wouldn't match its smaller amount.
        const fee = periodFees({
          amountPerPeriod:
            Math.round(Number(engagement.amount_per_period) * fraction * 100) /
            100,
          mode: engagement.settlement_mode,
        });
        return {
          engagement_id: engagement.id,
          organisation_id: engagement.organisation_id,
          kinglancer_id: engagement.kinglancer_id,
          period_index: periodIndex,
          due_date: dateOnly(periodDueDate(anchorDate, cadence, periodIndex)),
          worker_amount: fee.workerAmount,
          platform_fee_client: fee.platformFeeClient,
          platform_fee_kinglancer: fee.platformFeeKinglancer,
          status: "due" as const,
        };
      });
    const created = await createEngagementPayments(inputs);
    return { created: created.length, paymentIds: created.map((p) => p.id) };
  }

  const anchorDate = new Date(
    engagement.kinglancer_signed_at ?? engagement.created_at,
  );
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

/** True once a bounded temporary role's advertised end date has no further
 * period left to bill — the natural "this term is over" signal used to
 * auto-close the engagement instead of leaving it active indefinitely. */
export async function isFinalBoundedRolePeriod(
  engagement: Engagement,
  periodIndex: number,
): Promise<boolean> {
  if (engagement.source_kind !== "org_role") return false;
  const job = await getJobById(engagement.source_id, { useServiceRole: true });
  if (job?.employment_type !== "temporary" || !job.scheduled_at || !job.ends_at)
    return false;
  const fractions = roleBillingFractions(
    new Date(job.scheduled_at),
    new Date(job.ends_at),
    engagement.cadence as Cadence,
  );
  return periodIndex >= fractions.length;
}
