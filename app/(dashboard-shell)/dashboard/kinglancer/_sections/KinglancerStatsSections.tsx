import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard-context";
import { ActionCentreSummaryCard } from "@/components/dashboard/ActionCentre";
import { getKinglancerActionCounts } from "@/lib/dashboard-action-rules";
import { getPendingReviewJobs } from "@/lib/db/reviews";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import PayoutSetupButton from "../PayoutSetupButton";
import StripeLoginButton from "../StripeLoginButton";
import { Stagger, StaggerItem } from "@/components/animations";
import { CheckCircle, Star, TrendingUp, Briefcase } from "lucide-react";

export async function KinglancerStatsSection() {
  const { supabase, user, profile } = await getDashboardContext();

  // Two targeted queries in parallel:
  // 1. Aggregate stats RPC — DB-level totals, no row limit, always accurate
  // 2. Active jobs count — index-only count query
  const [statsResult, activeJobsResult] = await Promise.all([
    supabase.rpc("get_kinglancer_stats", { p_kinglancer_id: user.id }),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("kinglancer_id", user.id)
      .in("status", ["in_progress", "completed", "disputed"]),
  ]);

  type KinglancerStats = { total_earned: number; total_held: number };
  const stats = ((statsResult.data as KinglancerStats[] | null) ?? [])[0] ?? {
    total_earned: 0,
    total_held: 0,
  };
  const totalEarned = stats.total_earned;
  const activeJobsCount = activeJobsResult.count ?? 0;

  const statCards = [
      value: totalEarned > 0 ? `£${totalEarned.toFixed(0)}` : "£0",
      icon: TrendingUp,
      color: "bg-green-50 text-green-600",
      href: null,
    },
    {
      label: "Active Jobs",
      value: String(activeJobsCount),
      icon: Briefcase,
      color: "bg-blue-50 text-blue-600",
      href: "/dashboard/kinglancer/jobs",
    },
    {
      label: "Completed",
      value: String(profile.jobs_completed),
      icon: CheckCircle,
      color: "bg-purple-50 text-purple-600",
      href: null,
    },
    {
      label: "Rating",
      value:
        profile.jobs_completed > 0 ? Number(profile.rating).toFixed(1) : "—",
      icon: Star,
      color: "bg-yellow-50 text-yellow-600",
      href: "/dashboard/profile",
    },
  ];

  const payoutStatus = {
    detailsSubmitted: Boolean(profile.stripe_onboarding_complete),
    payoutsEnabled: Boolean(profile.stripe_onboarding_complete),
  };

  return (
    <div className="space-y-6">
      <Stagger
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        staggerDelay={0.07}
      >
        {statCards.map((stat) => (
          <StaggerItem key={stat.label}>
            {stat.href ? (
              <Link
                href={stat.href}
                className="group block rounded-3xl border border-white bg-white/85 p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/10"
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${stat.color} transition-transform group-hover:scale-105`}
                >
                  <stat.icon size={18} />
                </div>
                <p className="text-2xl font-black text-slate-950">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
              </Link>
            ) : (
              <div className="rounded-3xl border border-white bg-white/85 p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${stat.color}`}
                >
                  <stat.icon size={18} />
                </div>
                <p className="text-2xl font-black text-slate-950">
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
              </div>
            )}
          </StaggerItem>
        ))}
      </Stagger>

      {!payoutStatus.payoutsEnabled && (
        <div className="flex flex-col gap-4 rounded-3xl border border-amber-200/80 bg-amber-50/90 p-5 shadow-lg shadow-amber-900/5 ring-1 ring-white sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <AlertCircle size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-950">
                {payoutStatus.detailsSubmitted
                  ? "Stripe is verifying your payout account"
                  : "Connect your bank account to receive earnings"}
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                {payoutStatus.detailsSubmitted
                  ? "Your bank details were submitted. Once Stripe enables payouts, approved payments will go straight to your bank."
                  : "Set up your payout account once — every approved payment goes straight to your bank."}
              </p>
            </div>
          </div>
          {!payoutStatus.detailsSubmitted && <PayoutSetupButton />}
        </div>
      )}

      {payoutStatus.payoutsEnabled && (
        <div className="flex justify-end">
          <StripeLoginButton />
        </div>
      )}
    </div>
  );
}

export function KinglancerStatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <LoadingBlock key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export async function KinglancerActionCentreSection() {
  const { supabase, user } = await getDashboardContext();

  const directRequestsResult = await supabase
    .from("jobs")
    .select("id, status, direct_request_status")
    .eq("invited_kinglancer_id", user.id)
    .in("direct_request_status", [
      "pending",
      "changes_requested",
      "accepted_pending_payment",
    ])
    .limit(100);

  const transactionsResult = await supabase
    .from("transactions")
    .select("job_id")
    .eq("kinglancer_id", user.id)
    .in("status", ["held", "released", "disputed"]);

  const pendingReviews = await getPendingReviewJobs(user.id, "kinglancer");

  const fundedJobIds = new Set(
    (transactionsResult.data ?? []).map((t) => t.job_id),
  );
  const jobs = (directRequestsResult.data ?? []).map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
  }));

  const counts = getKinglancerActionCounts(jobs);
  const actionCount = counts.actionCount + pendingReviews.length;
  const waitingCount = counts.waitingCount;

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
        Action Centre
      </h2>
      <ActionCentreSummaryCard
        actionCount={actionCount}
        waitingCount={waitingCount}
        waitingOnLabel="the client"
        actionDescription="Reply to direct requests from one structured page."
        idleDescription="Direct requests that need a reply will appear here."
      />
    </div>
  );
}

export function ActionCentreSkeleton() {
  return (
    <div>
      <LoadingBlock className="mb-3 h-3 w-28" />
      <LoadingBlock className="h-24 rounded-3xl" />
    </div>
  );
}
