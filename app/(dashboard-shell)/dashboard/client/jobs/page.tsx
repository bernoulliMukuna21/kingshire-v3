import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import { getPageNumber, getPageRange } from "@/lib/pagination";

const CLIENT_JOBS_PAGE_SIZE = 10;

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

  type JobRow = {
    id: string;
    title: string;
    status: string;
    budget: number;
    categories: string[];
    created_at: string;
    deadline: string | null;
    kinglancer: { full_name: string } | null;
  };

  const { data: jobsRaw, count } = await supabase
    .from("jobs")
    .select(
      `
      id, title, status, budget, categories, created_at, deadline,
      kinglancer:profiles!kinglancer_id(full_name)
    `,
      { count: "exact" },
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const jobs = (jobsRaw ?? []) as unknown as JobRow[];

  // Get application counts per job
  const jobIds = jobs.map((j) => j.id);
  const { data: appCounts } = jobIds.length
    ? await supabase.from("applications").select("job_id").in("job_id", jobIds)
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

        {!jobs || jobs.length === 0 ? (
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
          <div className="space-y-3">
            {jobs.map((job) => {
              const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.open;
              const appCount = countMap[job.id] ?? 0;
              const categories = compactCategories(job.categories ?? []);
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group block rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-slate-950 transition-colors group-hover:text-blue-600">
                        {job.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span className="font-bold text-slate-900">
                          £{Number(job.budget).toLocaleString()}
                        </span>
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
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge className={config.color}>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
                        />
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
            })}
            <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
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
  );
}
