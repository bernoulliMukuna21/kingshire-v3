import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { type JobStatus, JOBS_PAGE_SIZE } from "@/lib/jobs";
import { formatMoney, formatRateType, formatDeadline } from "@/lib/utils";
import { getDashboardContext } from "@/lib/dashboard-context";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Card, cardPadding } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import JobsTabBar from "@/components/dashboard/JobsTabBar";
import JobsPagination from "@/components/dashboard/JobsPagination";
import { getPageNumber, getPageRange } from "@/lib/pagination";

// ── Tab definitions ────────────────────────────────────────

// JobStatus is imported from @/lib/jobs — single source of truth.
type Tab = "all" | "active" | "completed" | "cancelled";

const TAB_STATUSES: Record<Tab, JobStatus[]> = {
  all: [],
  active: ["in_progress", "completed", "disputed"],
  completed: ["approved"],
  cancelled: ["cancelled"],
};

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

function parseTab(raw: string | undefined): Tab {
  if (raw === "all" || raw === "completed" || raw === "cancelled") return raw;
  return "active";
}

// ── Status display config ─────────────────────────────────

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; className: string; description: string }
> = {
  open: {
    label: "Open",
    className: "bg-green-100 text-green-700",
    description: "",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-100 text-blue-700",
    description: "Deliver the work, then submit it for client review.",
  },
  completed: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-700",
    description: "You submitted this work. The client needs to approve it.",
  },
  disputed: {
    label: "Disputed",
    className: "bg-red-100 text-red-700",
    description: "This job is being handled through the dispute process.",
  },
  approved: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700",
    description: "This job was approved and payment has been released.",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-500",
    description: "This job was cancelled.",
  },
};

// ── Types ─────────────────────────────────────────────────

type JobRow = {
  id: string;
  title: string;
  budget: number;
  rate_type: "fixed" | "per_hour" | "per_day";
  status: JobStatus;
  deadline: string | null;
  updated_at: string;
  client: { full_name: string | null } | null;
};

type Transaction = {
  job_id: string;
  amount: number;
  platform_fee_kinglancer: number;
  status: string;
};


// ── Page ──────────────────────────────────────────────────

export default async function KinglancerJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  // getDashboardContext is React-cached — reuses the result already fetched
  // by the layout with zero extra DB round trips.
  const { supabase, user } = await getDashboardContext();
  const { page: pageParam, tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page, JOBS_PAGE_SIZE);

  // Lightweight query for tab counts + stats cards
  const { data: allStatuses } = await supabase
    .from("jobs")
    .select("status")
    .eq("kinglancer_id", user.id);

  const statusRows = allStatuses ?? [];
  const tabCounts: Record<Tab, number> = {
    all: statusRows.length,
    active: statusRows.filter((r) =>
      TAB_STATUSES.active.includes(r.status),
    ).length,
    completed: statusRows.filter((r) =>
      TAB_STATUSES.completed.includes(r.status),
    ).length,
    cancelled: statusRows.filter((r) =>
      TAB_STATUSES.cancelled.includes(r.status),
    ).length,
  };

  // Paginated jobs for current tab
  let jobsQuery = supabase
    .from("jobs")
    .select(
      "id, title, budget, rate_type, status, deadline, updated_at, client:profiles!client_id(full_name)",
      { count: "exact" },
    )
    .eq("kinglancer_id", user.id)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (TAB_STATUSES[tab].length > 0) {
    jobsQuery = jobsQuery.in("status", TAB_STATUSES[tab]);
  }

  // Transactions for held escrow amounts
  const [jobsResult, transactionsResult] = await Promise.all([
    jobsQuery,
    supabase
      .from("transactions")
      .select("job_id, amount, platform_fee_kinglancer, status")
      .eq("kinglancer_id", user.id)
      .in("status", ["held", "disputed"]),
  ]);

  const jobs = (jobsResult.data ?? []) as unknown as JobRow[];
  const count = jobsResult.count;
  const transactions = (transactionsResult.data ?? []) as Transaction[];

  const transactionByJob = new Map(
    transactions.map((t) => [t.job_id, t]),
  );
  const totalHeld = transactions
    .filter((t) => t.status === "held")
    .reduce((sum, t) => sum + t.amount - t.platform_fee_kinglancer, 0);

  // Submitted = jobs with status "completed" (awaiting client approval)
  const submittedCount = statusRows.filter(
    (r) => r.status === "completed",
  ).length;

  const tabs: Tab[] = ["active", "completed", "cancelled", "all"];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Kinglancer work"
        title="My Jobs"
        description="Track the jobs you have been selected for, submit completed work, and monitor approval status."
        action={
          <ButtonLink href="/jobs" variant="secondary">
            Browse jobs
          </ButtonLink>
        }
      />

      {/* ── Stats cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Active
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {tabCounts.active}
          </p>
        </Card>
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Submitted
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {submittedCount}
          </p>
        </Card>
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Held in escrow
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {formatMoney(totalHeld)}
          </p>
        </Card>
      </div>

      {/* ── Tab bar ── */}
      <JobsTabBar
        tabs={tabs}
        labels={TAB_LABELS}
        counts={tabCounts}
        activeTab={tab}
        basePath="/dashboard/kinglancer/jobs"
      />

      {/* ── Job list ── */}
      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title={
            tab === "all"
              ? "No jobs yet"
              : `No ${TAB_LABELS[tab].toLowerCase()} jobs`
          }
          description={
            tab === "active"
              ? "When a client selects you and funds escrow, your active jobs will appear here."
              : `You have no jobs in the ${TAB_LABELS[tab].toLowerCase()} category right now.`
          }
          action={
            tab === "active" || tab === "all" ? (
              <ButtonLink href="/jobs">Browse open jobs</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusConfig = STATUS_CONFIG[job.status];
            const transaction = transactionByJob.get(job.id);
            const heldAmount =
              transaction && transaction.status === "held"
                ? transaction.amount - transaction.platform_fee_kinglancer
                : null;

            return (
              <Link
                key={job.id}
                href={`/dashboard/kinglancer/jobs/${job.id}`}
                className="group block"
              >
                <Card
                  interactive
                  className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-slate-950 transition-colors group-hover:text-blue-700">
                        {job.title}
                      </h2>
                      <StatusBadge className={statusConfig.className}>
                        {statusConfig.label}
                      </StatusBadge>
                    </div>
                    {statusConfig.description && (
                      <p className="mt-1 text-sm text-slate-500">
                        {statusConfig.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={14} />
                        {job.client?.full_name ?? "Client"}
                      </span>
                      {job.deadline && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={14} />
                          Due {formatDeadline(job.deadline)}
                        </span>
                      )}
                      {job.status === "disputed" && (
                        <span className="inline-flex items-center gap-1.5 text-red-600">
                          <AlertTriangle size={14} />
                          Dispute active
                        </span>
                      )}
                      {job.status === "completed" && (
                        <span className="inline-flex items-center gap-1.5 text-amber-600">
                          <CheckCircle2 size={14} />
                          Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black text-slate-950">
                        {formatMoney(Number(job.budget))}
                        <span className="ml-1 text-sm font-bold text-slate-400">
                          {formatRateType(job.rate_type)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {heldAmount !== null
                          ? `${formatMoney(heldAmount)} held`
                          : job.status === "approved"
                            ? "Payment released"
                            : ""}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-slate-300 transition-colors group-hover:text-blue-500"
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
          <JobsPagination
            basePath="/dashboard/kinglancer/jobs"
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
