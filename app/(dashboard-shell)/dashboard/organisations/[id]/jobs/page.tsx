import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { type JobStatus, JOBS_PAGE_SIZE, jobStatusPill } from "@/lib/jobs";
import { getPageNumber, getPageRange } from "@/lib/pagination";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import JobsTabBar from "@/components/dashboard/JobsTabBar";
import JobsPagination from "@/components/dashboard/JobsPagination";
import OrganisationWorkspaceHeader from "../OrganisationWorkspaceHeader";

// ── Tab definitions ────────────────────────────────────────

type Tab =
  | "history"
  | "open"
  | "active"
  | "completed"
  | "disputed"
  | "cancelled";

const TAB_STATUSES: Record<Tab, JobStatus[]> = {
  history: [],
  open: ["open"],
  active: ["in_progress", "completed"],
  completed: ["approved"],
  disputed: ["disputed"],
  cancelled: ["cancelled"],
};

const TAB_LABELS: Record<Tab, string> = {
  history: "History",
  open: "Open",
  active: "Active",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

function parseTab(raw: string | undefined): Tab {
  if (
    raw === "history" ||
    raw === "open" ||
    raw === "completed" ||
    raw === "disputed" ||
    raw === "cancelled"
  )
    return raw;
  return "active";
}

function compactCategories(categories: string[]) {
  const visible = categories.slice(0, 2);
  const remaining = categories.length - visible.length;
  return { visible, remaining };
}

type JobRow = {
  id: string;
  title: string;
  status: JobStatus;
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

export default async function OrganisationJobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, tab: tabParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();
  const canManageMembers =
    membership.role === "owner" || membership.role === "admin";
  const canPostJob = await requireOrganisationPermission(
    id,
    user.id,
    "manage_jobs",
  );

  const tab = parseTab(tabParam);
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page, JOBS_PAGE_SIZE);

  const db = createServiceClient();
  const JOB_SELECT = `
    id, title, status, budget, categories, created_at, deadline,
    invited_kinglancer_id, direct_request_status,
    kinglancer:profiles!kinglancer_id(full_name),
    invited_kinglancer:profiles!invited_kinglancer_id(full_name)
  `;

  const { data: allStatuses } = await db
    .from("jobs")
    .select("status")
    .eq("organisation_id", id);

  const statusRows = allStatuses ?? [];
  const tabCounts: Record<Tab, number> = {
    history: statusRows.length,
    open: statusRows.filter((r) => TAB_STATUSES.open.includes(r.status)).length,
    active: statusRows.filter((r) => TAB_STATUSES.active.includes(r.status))
      .length,
    completed: statusRows.filter((r) =>
      TAB_STATUSES.completed.includes(r.status),
    ).length,
    disputed: statusRows.filter((r) => TAB_STATUSES.disputed.includes(r.status))
      .length,
    cancelled: statusRows.filter((r) =>
      TAB_STATUSES.cancelled.includes(r.status),
    ).length,
  };

  let query = db
    .from("jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("organisation_id", id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (TAB_STATUSES[tab].length > 0) {
    query = query.in("status", TAB_STATUSES[tab]);
  }

  const { data: jobsRaw, count } = await query;
  const jobs = (jobsRaw ?? []) as unknown as JobRow[];

  const { data: appCounts } = jobs.length
    ? await db
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

  const tabs: Tab[] = [
    "active",
    "open",
    "completed",
    "disputed",
    "cancelled",
    "history",
  ];
  const basePath = `/dashboard/organisations/${id}/jobs`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        active="jobs"
        canManageMembers={canManageMembers}
      />

      <JobsTabBar
        tabs={tabs}
        labels={TAB_LABELS}
        counts={tabCounts}
        activeTab={tab}
        basePath={basePath}
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">💼</span>}
          title={
            tab === "history"
              ? "No jobs posted yet"
              : `No ${TAB_LABELS[tab].toLowerCase()} jobs`
          }
          description={
            tab === "history"
              ? "Post the Organisation's first paid job."
              : `No jobs in the ${TAB_LABELS[tab].toLowerCase()} category right now.`
          }
          action={
            tab === "history" && canPostJob ? (
              <ButtonLink href={`${basePath}/post`} size="sm">
                Post a job
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              countMap={countMap}
              organisationId={id}
            />
          ))}
          <JobsPagination
            basePath={basePath}
            page={page}
            total={count ?? 0}
            pageSize={JOBS_PAGE_SIZE}
            tab={tab}
          />
        </div>
      )}
    </div>
  );
}

// ── JobCard ────────────────────────────────────────────────

function JobCard({
  job,
  countMap,
  organisationId,
}: {
  job: JobRow;
  countMap: Record<string, number>;
  organisationId: string;
}) {
  const isDirectRequest = !!job.invited_kinglancer_id;
  const config = jobStatusPill(job.status);
  const appCount = countMap[job.id] ?? 0;
  const categories = compactCategories(job.categories ?? []);
  const needsAttention =
    job.status === "completed" || job.status === "disputed";

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
        href={`/dashboard/organisations/${organisationId}/jobs/${job.id}`}
        className="block p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
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
            <StatusBadge className={config.className}>
              <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
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
    </div>
  );
}
