import Link from "next/link";
import { ChevronRight, DollarSign } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard-context";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

const APP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-50 text-yellow-700" },
  accepted: { label: "Selected", color: "bg-green-50 text-green-700" },
  rejected: { label: "Not Selected", color: "bg-gray-100 text-gray-500" },
};

const JOB_DISPUTED_STATUS = {
  label: "Disputed",
  color: "bg-red-50 text-red-600",
};

export async function KinglancerApplicationsSection() {
  const { supabase, user } = await getDashboardContext();

  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, cover_letter, created_at, job:jobs(id, title, budget, status, deadline, client_id)",
    )
    .eq("kinglancer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const applications = (data ?? []) as Array<{
    id: string;
    status: string;
    cover_letter: string;
    created_at: string;
    job: {
      id: string;
      title: string;
      budget: number;
      status: string;
      deadline: string | null;
      client_id: string;
    } | null;
  }>;

  return (
    <div className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-black text-slate-950">My Applications</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Recent applications and selection status
          </p>
        </div>
        <Link
          href="/jobs"
          className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          Browse jobs
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <DollarSign size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">
            No applications yet.
          </p>
          <Link
            href="/jobs"
            className="mt-4 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700"
          >
            Browse open jobs
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {applications.map((app) => {
            if (!app.job) return null;
            const isDisputed = app.job.status === "disputed";
            const s = isDisputed
              ? JOB_DISPUTED_STATUS
              : (APP_STATUS[app.status] ?? APP_STATUS.pending);
            return (
              <Link
                key={app.id}
                href={`/dashboard/kinglancer/jobs/${app.job.id}`}
                className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="truncate font-bold text-slate-950 transition-colors group-hover:text-blue-700">
                    {app.job.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {isDisputed
                      ? "This job is under dispute."
                      : app.status === "accepted"
                        ? "You have been selected!"
                        : app.status === "rejected"
                          ? "Another applicant was chosen."
                          : "Application under review."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`hidden sm:inline px-3 py-1 rounded-full text-xs font-medium ${s.color}`}
                  >
                    {s.label}
                  </span>
                  <span className="font-black text-slate-950">
                    £{Number(app.job.budget).toLocaleString()}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 group-hover:text-blue-500 transition-colors"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function KinglancerApplicationsSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <LoadingBlock className="h-5 w-36" />
        <LoadingBlock className="mt-2 h-3 w-48" />
      </div>
      <div className="divide-y divide-slate-100">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between px-5 py-4 sm:px-6"
          >
            <div className="flex-1 pr-4">
              <LoadingBlock className="h-4 w-3/4" />
              <LoadingBlock className="mt-2 h-3 w-1/2" />
            </div>
            <LoadingBlock className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
