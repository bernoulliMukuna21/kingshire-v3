import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, Send, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import { getPageNumber, getPageRange } from "@/lib/pagination";

const CLIENT_JOBS_PAGE_SIZE = 5;

const ACTIVE_STATUSES = ["in_progress", "completed", "disputed"] as const;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  open: {
    label: "Open",
    color: "bg-green-50 text-green-700 ring-green-100",
    dot: "bg-green-500",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-50 text-blue-700 ring-blue-100",
    dot: "bg-blue-500",
  },
  completed: {
    label: "Awaiting Approval",
    color: "bg-yellow-50 text-yellow-700 ring-yellow-100",
    dot: "bg-yellow-500",
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-50 text-red-700 ring-red-100",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-500 ring-gray-200",
    dot: "bg-gray-400",
  },
};

function compactCategories(categories: string[]) {
  const visible = categories.slice(0, 2);
  const remaining = categories.length - visible.length;
  return { visible, remaining };
}

type JobRow = {
  id: string;
  title: string;
  status: string;
  budget: number;
  categories: string[];
  created_at: string;
  deadline: string | null;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
  kinglancer: { full_name: string } | null;
  invited_kinglancer: { full_name: string } | null;
};

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { page: pageParam } = await searchParams;
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page, CLIENT_JOBS_PAGE_SIZE);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

  const JOB_SELECT = `
      id, title, status, budget, categories, created_at, deadline,
      invited_kinglancer_id, direct_request_status,
      kinglancer:profiles!kinglancer_id(full_name),
      invited_kinglancer:profiles!invited_kinglancer_id(full_name)
    `;

  // Active jobs — always shown at top, unpaginated
  const { data: activeJobsRaw } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("client_id", user.id)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false });

  // Other jobs — paginated
  const { data: jobsRaw, count } = await supabase
    .from("jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("client_id", user.id)
    .not("status", "in", `(${ACTIVE_STATUSES.join(",")})`)
    .order("created_at", { ascending: false })
    .range(from, to);

  const activeJobs = (activeJobsRaw ?? []) as unknown as JobRow[];
  const jobs = (jobsRaw ?? []) as unknown as JobRow[];

  // Get application counts for all jobs combined
  const allJobIds = [...activeJobs, ...jobs].map((j) => j.id);
  const { data: appCounts } = allJobIds.length
    ? await supabase
        .from("applications")
        .select("job_id")
        .in("job_id", allJobIds)
    : { data: [] };

  const countMap = (appCounts ?? []).reduce<Record<string, number>>(
    (acc, row) => ({ ...acc, [row.job_id]: (acc[row.job_id] ?? 0) + 1 }),
    {},
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Client"
        title="My Jobs"
        description="All jobs you have posted — track progress and manage applicants."
        action={
          <ButtonLink href="/jobs/post" variant="secondary">
            <Plus size={16} />
            Post a Job
          </ButtonLink>
        }
      />

      {activeJobs.length === 0 && jobs.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">💼</span>}
          title="No jobs posted yet"
          description="Post your first job to start finding skilled community members."
          action={
            <ButtonLink href="/jobs/post" size="sm">
              <Plus size={15} />
              Post your first job
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* ── Active / needs attention ── */}
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-blue-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Active ({activeJobs.length})
                </h2>
              </div>
              {activeJobs.map((job) => (
                <JobCard key={job.id} job={job} countMap={countMap} highlight />
              ))}
            </div>
          )}

          {/* ── All other jobs (paginated) ── */}
          {jobs.length > 0 && (
            <div className="space-y-3">
              {activeJobs.length > 0 && (
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    All Jobs
                  </h2>
                </div>
              )}
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} countMap={countMap} />
              ))}
              <div className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
                <Pagination
                  basePath="/dashboard/client/jobs"
                  page={page}
                  total={count ?? 0}
                  pageSize={CLIENT_JOBS_PAGE_SIZE}
                  itemLabel="jobs"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  countMap,
  highlight = false,
}: {
  job: JobRow;
  countMap: Record<string, number>;
  highlight?: boolean;
}) {
  const isDirectRequest = !!job.invited_kinglancer_id;
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.open;
  const appCount = countMap[job.id] ?? 0;
  const categories = compactCategories(job.categories ?? []);
  const directStatusLabel: Record<string, string> = {
    pending: "Awaiting response",
    changes_requested: "Changes requested",
    accepted_pending_payment: "Awaiting payment",
    declined: "Declined",
    cancelled: "Cancelled",
  };

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`group block rounded-3xl border p-5 shadow-xl transition-all hover:-translate-y-0.5 sm:p-6 ${
        highlight
          ? "border-blue-100 bg-blue-50/60 shadow-blue-900/5 ring-1 ring-blue-200/60 hover:border-blue-200"
          : "border-white bg-white/90 shadow-slate-900/5 ring-1 ring-slate-200/50 hover:border-blue-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDirectRequest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                <Send size={10} />
                Direct
              </span>
            )}
            <h3 className="truncate text-base font-black text-slate-950 transition-colors group-hover:text-blue-600">
              {job.title}
            </h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-bold text-slate-900">
              £{Number(job.budget).toLocaleString()}
            </span>
            {isDirectRequest ? (
              <>
                {job.invited_kinglancer && (
                  <span className="text-xs text-slate-500">
                    → {job.invited_kinglancer.full_name}
                  </span>
                )}
                {job.direct_request_status && (
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-600">
                    {directStatusLabel[job.direct_request_status] ??
                      job.direct_request_status}
                  </span>
                )}
              </>
            ) : (
              <>
                {appCount > 0 && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {appCount} applicant{appCount !== 1 ? "s" : ""}
                  </span>
                )}
                {job.kinglancer && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    Assigned
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge className={config.color}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </StatusBadge>
          <ChevronRight
            size={18}
            className="text-gray-300 transition-colors group-hover:text-blue-400"
          />
        </div>
      </div>

      {(categories.visible.length > 0 || job.kinglancer) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {categories.visible.map((category) => (
            <span
              key={category}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"
            >
              {category}
            </span>
          ))}
          {categories.remaining > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-400">
              +{categories.remaining} more
            </span>
          )}
          {job.kinglancer && (
            <span className="text-xs font-semibold text-slate-400">
              Assigned to {job.kinglancer.full_name}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
