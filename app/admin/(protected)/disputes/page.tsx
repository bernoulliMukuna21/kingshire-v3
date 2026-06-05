import Link from "next/link";
import { Eye } from "lucide-react";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminPanel from "@/components/admin/AdminPanel";
import { FadeIn } from "@/components/animations";
import PageHeader from "@/components/ui/PageHeader";
import DisputeActions from "./DisputeActions";
import {
  ADMIN_PAGE_SIZE,
  type AdminDispute,
  formatMoney,
  getPageNumber,
  getPageRange,
  timeAgo,
} from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page);
  const serviceDb = createServiceClient();

  const { data, count } = await serviceDb
    .from("disputes")
    .select(
      "id, reason, created_at, status, raised_by, job:jobs!job_id(id, title, budget, client_id, kinglancer_id)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const disputes = (data ?? []) as unknown as AdminDispute[];

  return (
    <>
      <FadeIn className="mb-8">
        <PageHeader
          eyebrow="Admin"
          title="Disputes"
          description="Review disputed jobs and use the linked job page for context."
        />
      </FadeIn>

      <FadeIn>
        <AdminPanel
          title="All Disputes"
          description="Newest disputes first."
          count={count ?? 0}
          tone="red"
        >
          {disputes.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400">
              No disputes found.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {disputes.map((dispute) => (
                <div
                  key={dispute.id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {dispute.job?.title ?? "Unknown job"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {dispute.reason}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      Raised {timeAgo(dispute.created_at)}
                    </p>
                    {dispute.status === "open" && dispute.job && (
                      <div className="mt-3">
                        <DisputeActions
                          disputeId={dispute.id}
                          jobBudget={dispute.job.budget}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {dispute.job && (
                      <span className="text-sm font-black text-gray-900">
                        {formatMoney(dispute.job.budget)}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ${
                        dispute.status === "open"
                          ? "bg-red-50 text-red-700 ring-red-100"
                          : "bg-green-50 text-green-700 ring-green-100"
                      }`}
                    >
                      {dispute.status}
                    </span>
                    {dispute.job && (
                      <Link
                        href={`/jobs/${dispute.job.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:underline"
                      >
                        <Eye size={14} /> View job
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <AdminPagination
            basePath="/admin/disputes"
            page={page}
            total={count ?? 0}
            pageSize={ADMIN_PAGE_SIZE}
          />
        </AdminPanel>
      </FadeIn>
    </>
  );
}
