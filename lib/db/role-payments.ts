import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementsByIds } from "@/lib/db/engagements";
import {
  getDisputedEngagementPayments,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";

export type DisputedRolePayment = EngagementPaymentRow & {
  jobTitle: string | null;
  organisationName: string | null;
  kinglancerName: string | null;
};

/** Disputed periods for Organisation-role engagements, enriched for admin review. */
export async function listDisputedRolePayments(): Promise<DisputedRolePayment[]> {
  const payments = await getDisputedEngagementPayments();
  const engagementsById = await getEngagementsByIds(
    payments.map((payment) => payment.engagement_id),
  );
  const rolePayments = payments.filter(
    (payment) => engagementsById.get(payment.engagement_id)?.source_kind === "org_role",
  );
  if (rolePayments.length === 0) return [];

  const jobIds = rolePayments.map(
    (payment) => engagementsById.get(payment.engagement_id)!.source_id,
  );
  const organisationIds = rolePayments.map((payment) => payment.organisation_id);
  const kinglancerIds = rolePayments.map((payment) => payment.kinglancer_id);

  const db = createServiceClient();
  const [{ data: jobs }, { data: organisations }, { data: profiles }] =
    await Promise.all([
      db.from("jobs").select("id, title").in("id", [...new Set(jobIds)]),
      db
        .from("organisations")
        .select("id, name")
        .in("id", [...new Set(organisationIds)]),
      db
        .from("profiles")
        .select("id, full_name")
        .in("id", [...new Set(kinglancerIds)]),
    ]);
  const jobTitleById = new Map((jobs ?? []).map((job) => [job.id, job.title]));
  const orgNameById = new Map(
    (organisations ?? []).map((org) => [org.id, org.name]),
  );
  const kinglancerNameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  return rolePayments.map((payment) => {
    const engagement = engagementsById.get(payment.engagement_id)!;
    return {
      ...payment,
      jobTitle: jobTitleById.get(engagement.source_id) ?? null,
      organisationName: orgNameById.get(payment.organisation_id) ?? null,
      kinglancerName: kinglancerNameById.get(payment.kinglancer_id) ?? null,
    };
  });
}
