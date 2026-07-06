import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import { getPageNumber, getPageRange } from "@/lib/pagination";
import DeleteJobButton from "./DeleteJobButton";

const CLIENT_JOBS_PAGE_SIZE = 10;

// ── Tab definitions ────────────────────────────────────────

type Tab = "all" | "open" | "active" | "closed";

const TAB_STATUSES: Record<Tab, string[]> = {
  all: [],
  open: ["open"],
  active: ["in_progress", "completed", "disputed"],
  closed: ["approved", "cancelled"],
};

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  open: "Open",
  active: "Active",
  closed: "Closed",
};

function parseTab(raw: string | undefined): Tab {
  if (raw === "all" || raw === "active" || raw === "closed") return raw;
  return "open";
}

// ── Status display config ─────────────────────────────────

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
  approved: {
    label: "Completed",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
  },
};

// ── Helpers ───────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const { page: pageParam, tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page, CLIENT_JOBS_PAGE_SIZE);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
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

  // One lightweight query for tab counts
  const { data: allStatuses } = await supabase
    .from("jobs")
    .select("status")
    .eq("client_id", user.id);

  const statusRows = allStatuses ?? [];
  const tabCounts: Record<Tab, number> = {
    all: statusRows.length,
    open: statusRows.filter((r) => TAB_STATUSES.open.includes(r.status)).length,
    active: statusRows.filter((r) =>
      TAB_STATUSES.active.includes(r.status),
    ).length,
    closed: statusRows.filter((r) =>
      TAB_STATUSES.closed.includes(r.status),
    ).length,
  };

  // Main paginated jobs query — filtered by active tab
  let query = supabase
    .from("jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (TAB_STATUSES[tab].length > 0) {
    query = query.in(
      "status",
      TAB_STATUSES[tab] as (
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
        | "approved"
      )[],
    );
  }

  const { data: jobsRaw, count } = await query;
  const jobs = (jobsRaw ?? []) as unknown as JobRow[];

  // Application counts for the visible jobs
  const { data: appCounts } = jobs.length
    ? await supabase
        .from("applications")
        .select("job_id")
        .in(
          "job_id",
          jobs.map((j) => j.id),
        )
    : { data: [] };

  const countMap = (appCounts ?? []).reduce<Record<string, number>>(
    (acc, row) => ({ ...acc, [row.job_id]: (acc[row.job_id] ?? 0) + 1 }),
    {},
  );

  const tabs: Tab[] = ["all", "open", "active", "closed"];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
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

      {/* ── Tab bar ── */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((t) => {
          const isActive = t === tab;
          return (
            <Link
              key={t}
              href={`/dashboard/client/jobs?tab=${t}`}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {TAB_LABELS[t]}
              {tabCounts[t] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-black tabular-nums ${
                    isActive
                      ? t === "active"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {tabCounts[t]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Job list ── */}
      {jobs.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">💼</span>}
          title={
            tab === "all"
              ? "No jobs posted yet"
              : `No ${TAB_LABELS[tab].toLowerCase()} jobs`
          }
          description={
            tab === "all"
              ? "Post your first job to start finding skilled community members."
              : `You have no jobs in the ${TAB_LABELS[tab].toLowerCase()} category right now.`
          }
          action={
            tab === "all" ? (
              <ButtonLink href="/jobs/post" size="sm">
                <Plus size={15} />
                Post your first job
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
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
              params={tab !== "all" ? { tab } : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── JobCard ────────────────────────────────────────────────

function JobCard({
  job,
  countMap,
}: {
  job: JobRow;
  countMap: Record<string, number>;
}) {
  const isDirectRequest = !!job.invited_kinglancer_id;
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.open;
  const appCount = countMap[job.id] ?? 0;
  const categories = compactCategories(job.categories ?? []);
  const needsAttention =
    job.status === "completed" || job.status === "disputed";
  const canDelete = job.status === "open" || job.status === "cancelled";

  const directStatusLabel: Record<string, string> = {
    pending: "Awaiting response",
    changes_requested: "Changes requested",
    accepted_pending_payment: "Awaiting payment",
    declined: "Declined",
    cancelled: "Cancelled",
  };

  return (
    <div
      className={`group rounded-3xl border shadow-xl transition-all hover:-translate-y-0.5 ${
        needsAttention
          ? "border-yellow-100 bg-yellow-50/40 shadow-yellow-900/5 ring-1 ring-yellow-200/60 hover:border-yellow-200"
          : "border-white bg-white/90 shadow-slate-900/5 ring-1 ring-slate-200/50 hover:border-blue-100"
      }`}
    >
      <Link
        href={`/dashboard/client/jobs/${job.id}`}
        className="block p-5 sm:p-6"
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
            {!canDelete && (
              <ChevronRight
                size={18}
                className="text-gray-300 transition-colors group-hover:text-blue-400"
              />
            )}
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

      {canDelete && (
        <div className="flex items-center justify-end border-t border-slate-100 px-5 pb-3 pt-2.5 sm:px-6">
          <DeleteJobButton
            jobId={job.id}
            jobTitle={job.title}
            appCount={appCount}
          />
        </div>
      )}
    </div>
  );
}

