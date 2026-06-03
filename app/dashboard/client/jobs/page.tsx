import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  open: {
    label: "Open",
    color: "bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  completed: {
    label: "Awaiting Approval",
    color: "bg-yellow-50 text-yellow-700",
    dot: "bg-yellow-500",
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
};

export default async function MyJobsPage() {
  const supabase = await createClient();
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

  const { data: jobsRaw } = await supabase
    .from("jobs")
    .select(
      `
      id, title, status, budget, categories, created_at, deadline,
      kinglancer:profiles!kinglancer_id(full_name)
    `,
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

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

  const navItems = getNavItems("client", "/dashboard/client/jobs");

  return (
    <DashboardShell profile={profile} navItems={navItems}>
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
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group flex items-center gap-4 rounded-[1.5rem] border border-white bg-white/90 px-6 py-4 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-slate-950 font-bold truncate group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      <StatusBadge className={`shrink-0 ${config.color}`}>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
                        />
                        {config.label}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>£{Number(job.budget).toLocaleString()}</span>
                      <span>{(job.categories ?? []).join(", ")}</span>
                      {appCount > 0 && (
                        <span className="text-blue-600 font-medium">
                          {appCount} applicant{appCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {job.kinglancer && (
                        <span className="text-green-600">
                          Assigned to {job.kinglancer.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
