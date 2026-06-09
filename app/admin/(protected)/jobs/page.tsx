export const dynamic = "force-dynamic";

import Link from "next/link";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminPanel from "@/components/admin/AdminPanel";
import { FadeIn } from "@/components/animations";
import PageHeader from "@/components/ui/PageHeader";
import {
  ADMIN_PAGE_SIZE,
  type AdminJob,
  formatMoney,
  getPageNumber,
  getPageRange,
  jobStatusClasses,
  timeAgo,
} from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page);
  const serviceDb = createServiceClient();

  const { data, count } = await serviceDb
    .from("jobs")
    .select(
      "id, title, status, budget, categories, created_at, client:profiles!client_id(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const jobs = (data ?? []) as unknown as AdminJob[];

  return (
    <>
      <FadeIn className="mb-8">
        <PageHeader
          eyebrow="Admin"
          title="Jobs"
          description="Operational view of jobs across every status."
        />
      </FadeIn>

      <FadeIn>
        <AdminPanel
          title="All Jobs"
          description="Newest jobs first."
          count={count ?? 0}
        >
          {jobs.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400">No jobs found.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {job.client?.full_name ?? "Unknown client"} · Created{" "}
                      {timeAgo(job.created_at)}
                    </p>
                    {job.categories && job.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.categories.slice(0, 3).map((category) => (
                          <span
                            key={category}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${jobStatusClasses(job.status)}`}
                    >
                      {job.status.replace("_", " ")}
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {formatMoney(job.budget)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <AdminPagination
            basePath="/admin/jobs"
            page={page}
            total={count ?? 0}
            pageSize={ADMIN_PAGE_SIZE}
          />
        </AdminPanel>
      </FadeIn>
    </>
  );
}
