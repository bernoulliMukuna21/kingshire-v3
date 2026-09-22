import { createEngagement, getEngagementBySource } from "@/lib/db/engagements";
import type { Engagement } from "@/lib/db/engagements";

export type OrganisationRoleJob = {
  id: string;
  organisation_id: string;
  employment_type: string | null;
  pay_cadence: string | null;
  pay_amount: number | string | null;
  pay_negotiable: boolean;
  settlement_mode: string | null;
};

export async function createRoleEngagement(args: {
  job: OrganisationRoleJob;
  kinglancerId: string;
  organisationSignerId: string;
  agreedAmount?: number;
  agreedCadence?: "weekly" | "monthly";
  agreedSettlementMode?: "managed" | "direct";
}): Promise<Engagement> {
  const existing = await getEngagementBySource("org_role", args.job.id);
  if (existing) return existing;

  const cadence = args.agreedCadence ?? args.job.pay_cadence;
  const settlementMode = args.agreedSettlementMode ?? args.job.settlement_mode;
  const amount = args.agreedAmount ?? Number(args.job.pay_amount);
  if (!cadence || !settlementMode) {
    throw new Error("Role payment terms are incomplete");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Role pay must be agreed before hiring");
  }

  return createEngagement({
    source_kind: "org_role",
    source_id: args.job.id,
    organisation_id: args.job.organisation_id,
    kinglancer_id: args.kinglancerId,
    settlement_mode: settlementMode,
    cadence,
    amount_per_period: amount,
    duration_periods: args.job.employment_type === "temporary" ? null : null,
    status: "pending_acceptance",
    org_signed_by: args.organisationSignerId,
    org_signed_at: new Date().toISOString(),
  });
}
