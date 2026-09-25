import { getPendingReviewJobs } from "@/lib/db/reviews";
import { listKinglancerAgreements } from "@/lib/db/placements";
import type {
  ActionCentreItem,
  ActionCentreRole,
  ActionProvider,
  ClientActionJob,
  KinglancerActionJob,
  ServerClient,
} from "./types";
import {
  buildClientJobItems,
  buildKinglancerJobItems,
  buildPlacementItems,
  buildReviewItems,
} from "./mappers";

async function getFundedJobIds(
  supabase: ServerClient,
  jobIds: string[],
): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set<string>();
  const { data } = await supabase
    .from("transactions")
    .select("job_id")
    .in("job_id", jobIds)
    .in("status", ["held", "released", "disputed"]);
  return new Set((data ?? []).map((transaction) => transaction.job_id));
}

export const clientJobsProvider: ActionProvider = ({ supabase, userId }) =>
  fetchClientStyleJobItems(supabase, "client_id", userId);

// Client and organisation job actions share the same shape; only the scoping
// column differs (personal jobs by client_id, org jobs by organisation_id).
export async function fetchClientStyleJobItems(
  supabase: ServerClient,
  column: "client_id" | "organisation_id",
  value: string,
): Promise<ActionCentreItem[]> {
  let query = supabase
    .from("jobs")
    .select(
      `
      id, title, status, budget, rate_type, posting_type, pay_negotiable, pay_amount, pay_cadence,
      invited_kinglancer_id, direct_request_status,
      counter_budget, counter_rate_type, counter_deadline,
      kinglancer:profiles!kinglancer_id(full_name),
      invited_kinglancer:profiles!invited_kinglancer_id(full_name)
    `,
    )
    .eq(column, value);

  // Personal scope excludes org-owned jobs — they belong to the org workspace.
  if (column === "client_id") query = query.is("organisation_id", null);

  const { data: jobsRaw } = await query
    .or(
      "status.eq.completed,status.eq.open,direct_request_status.eq.changes_requested,direct_request_status.eq.accepted_pending_payment,direct_request_status.eq.pending",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (jobsRaw ?? []) as unknown as ClientActionJob[];
  const jobIds = jobs.map((job) => job.id);

  const [applicationsResult, fundedJobIds, pendingPaymentResult] =
    await Promise.all([
      jobIds.length
        ? supabase
            .from("applications")
            .select("job_id")
            .in("job_id", jobIds)
            .eq("status", "pending")
        : Promise.resolve({ data: [] }),
      getFundedJobIds(supabase, jobIds),
      jobIds.length
        ? supabase
            .from("payment_attempts")
            .select("job_id")
            .in("job_id", jobIds)
            .eq("status", "pending")
        : Promise.resolve({ data: [] }),
    ]);

  const pendingPaymentJobIds = new Set(
    (pendingPaymentResult.data ?? []).map((row) => row.job_id),
  );

  const applicantCountByJob = (applicationsResult.data ?? []).reduce<
    Record<string, number>
  >((acc, row) => {
    acc[row.job_id] = (acc[row.job_id] ?? 0) + 1;
    return acc;
  }, {});

  const jobsWithFunding = jobs.map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
    has_pending_payment: pendingPaymentJobIds.has(job.id),
  }));

  return buildClientJobItems(jobsWithFunding, applicantCountByJob);
}

export const kinglancerJobsProvider: ActionProvider = async ({
  supabase,
  userId,
}) => {
  const { data: jobsRaw } = await supabase
    .from("jobs")
    .select(
      "id, title, status, budget, rate_type, posting_type, pay_negotiable, pay_amount, pay_cadence, direct_request_status, client:profiles!client_id(full_name)",
    )
    .eq("invited_kinglancer_id", userId)
    .in("direct_request_status", [
      "pending",
      "changes_requested",
      "accepted_pending_payment",
    ])
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (jobsRaw ?? []) as unknown as KinglancerActionJob[];
  const fundedJobIds = await getFundedJobIds(
    supabase,
    jobs.map((job) => job.id),
  );
  const jobsWithFunding = jobs.map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
  }));

  return buildKinglancerJobItems(jobsWithFunding);
};

export const reviewsProvider: ActionProvider = async ({ userId, role }) => {
  const pending = await getPendingReviewJobs(userId, role);
  return buildReviewItems(pending, role);
};

export const placementsProvider: ActionProvider = async ({ userId }) => {
  const agreements = await listKinglancerAgreements(userId);
  return buildPlacementItems(agreements);
};

export const PROVIDERS: Record<ActionCentreRole, ActionProvider[]> = {
  client: [clientJobsProvider, reviewsProvider],
  kinglancer: [kinglancerJobsProvider, reviewsProvider, placementsProvider],
};
