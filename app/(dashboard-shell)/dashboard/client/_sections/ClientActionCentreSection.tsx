import { getDashboardContext } from "@/lib/dashboard-context";
import { ActionCentreSummaryCard } from "@/components/dashboard/ActionCentre";
import { getClientActionCounts } from "@/lib/dashboard-action-rules";
import { getPendingReviewJobs } from "@/lib/db/reviews";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export async function ClientActionCentreSection() {
  const { supabase, user } = await getDashboardContext();

  const [jobsResult, transactionsResult, pendingReviews] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, status, invited_kinglancer_id, direct_request_status, applications:applications(count)",
      )
      .eq("client_id", user.id)
      .or("status.eq.open,status.eq.completed")
      .limit(100),
    supabase
      .from("transactions")
      .select("job_id")
      .eq("client_id", user.id)
      .in("status", ["held", "released", "disputed"]),
    getPendingReviewJobs(user.id, "client"),
  ]);

  const fundedJobIds = new Set(
    (transactionsResult.data ?? []).map((t) => t.job_id),
  );
  const rawJobs = (jobsResult.data ?? []) as Array<{
    id: string;
    status: string;
    invited_kinglancer_id: string | null;
    direct_request_status: string | null;
    applications: [{ count: number }] | null;
  }>;
  const jobs = rawJobs.map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
  }));

  const counts = getClientActionCounts(
    jobs,
    (job) => (job.applications as [{ count: number }] | null)?.[0]?.count ?? 0,
  );
  const actionCount = counts.actionCount + pendingReviews.length;
  const waitingCount = counts.waitingCount;

  return (
    <div>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        Action Centre
      </h2>
      <ActionCentreSummaryCard
        actionCount={actionCount}
        waitingCount={waitingCount}
        waitingOnLabel="the Kinglancer"
        actionDescription="Review approvals, applicants, requested changes, and escrow payments from one structured page."
      />
    </div>
  );
}

export function ActionCentreSkeleton() {
  return (
    <div>
      <LoadingBlock className="mb-3 h-3 w-28" />
      <LoadingBlock className="h-24 rounded-[1.75rem]" />
    </div>
  );
}
