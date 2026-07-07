import Link from "next/link";
import {
  CheckCircle,
  TrendingUp,
  Users,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import { getDashboardContext } from "@/lib/dashboard-context";

type InProgressJob = {
  id: string;
  title: string;
  budget: number;
  kinglancer: { full_name: string } | null;
};

type ClientStats = {
  total_spent: number;
  total_jobs: number;
  open_jobs: number;
  completed_jobs: number;
  total_applicants: number;
};

const EMPTY_STATS: ClientStats = {
  total_spent: 0,
  total_jobs: 0,
  open_jobs: 0,
  completed_jobs: 0,
  total_applicants: 0,
};

export async function ClientMainSection() {
  const { supabase, user, profile } = await getDashboardContext();

  // Two targeted queries in parallel:
  // 1. In-progress jobs only — for the "Active work" card list (bounded to 10)
  // 2. Aggregate stats RPC — DB-level computation, no row limit, always accurate
  const [inProgressResult, statsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, budget, kinglancer:profiles!kinglancer_id(full_name)")
      .eq("client_id", user.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_client_stats", { p_client_id: user.id }),
  ]);

  const inProgressJobs = (inProgressResult.data ??
    []) as unknown as InProgressJob[];
  const stats: ClientStats =
    ((statsResult.data as ClientStats[] | null) ?? [])[0] ?? EMPTY_STATS;

  const {
    total_spent: totalSpent,
    total_jobs: postedJobsCount,
    open_jobs: openJobsCount,
    completed_jobs: completedCount,
    total_applicants: totalApplicantCount,
  } = stats;

  return (
    <div className="space-y-8">
      {/* Active work */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Active work
        </h2>
        {inProgressJobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={22} />}
            title={
              postedJobsCount === 0 ? "No jobs posted yet" : "No active work"
            }
            description={
              postedJobsCount === 0
                ? "Post your first job to start receiving proposals from Kinglancers."
                : "Hire a Kinglancer to get the work moving."
            }
            action={
              postedJobsCount === 0 ? (
                <ButtonLink href="/jobs/post" size="sm">
                  Post a job
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <div className="space-y-2">
            {inProgressJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/client/jobs/${job.id}`}
                className="group flex items-center gap-4 rounded-3xl border border-white bg-white/90 px-5 py-4 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-blue-950/10"
              >
                <Avatar name={job.kinglancer?.full_name} tone="green" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-950 group-hover:text-blue-700 transition-colors truncate">
                    {job.title}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {job.kinglancer?.full_name ?? "Kinglancer"} · £
                    {Number(job.budget).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge>In progress</StatusBadge>
                  <ChevronRight
                    size={15}
                    className="text-gray-300 group-hover:text-blue-500 transition-colors"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Numbers */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Your numbers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/dashboard/client/jobs"
            className="group rounded-3xl border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-blue-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {postedJobsCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Jobs posted</p>
          </Link>

          <Link
            href="/dashboard/client/jobs"
            className="group rounded-3xl border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-emerald-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-emerald-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {openJobsCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Open jobs</p>
          </Link>

          <Link
            href="/dashboard/client/jobs"
            className="group rounded-3xl border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-purple-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-purple-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {totalApplicantCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Applicants</p>
          </Link>

          <Link
            href="/dashboard/client/transactions"
            className="group rounded-3xl border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-emerald-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-green-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {totalSpent > 0 ? `£${totalSpent.toLocaleString()}` : "£0"}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Total spent</p>
          </Link>
        </div>
        {completedCount > 0 && (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            {completedCount} completed job{completedCount !== 1 ? "s" : ""}{" "}
            included in your posted jobs.
          </p>
        )}
      </div>

      {/* Prompt to post if no jobs */}
      {postedJobsCount === 0 && profile.role === "client" && (
        <div className="text-center pt-2">
          <ButtonLink href="/jobs/post">Post your first job</ButtonLink>
        </div>
      )}
    </div>
  );
}

export function ClientMainSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <LoadingBlock className="mb-3 h-3 w-24" />
        <LoadingBlock className="h-20 rounded-[1.75rem]" />
      </div>
      <div>
        <LoadingBlock className="mb-3 h-3 w-28" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <LoadingBlock key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
