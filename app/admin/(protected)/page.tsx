import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  Eye,
  TrendingUp,
  Users,
} from "lucide-react";
import AdminPanel from "@/components/admin/AdminPanel";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  type AdminDispute,
  type AdminJob,
  type AdminUser,
  formatMoney,
  jobStatusClasses,
  roleTone,
  timeAgo,
} from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminDashboard() {
  const serviceDb = createServiceClient();

  const [
    usersCountResult,
    jobsResult,
    disputesResult,
    transactionsResult,
    recentUsersResult,
    recentJobsResult,
  ] = await Promise.all([
    serviceDb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or("role.is.null,role.neq.admin"),

    serviceDb.from("jobs").select("id, status"),

    serviceDb
      .from("disputes")
      .select(
        "id, reason, created_at, status, raised_by, job:jobs!job_id(id, title, budget, client_id, kinglancer_id)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),

    serviceDb
      .from("transactions")
      .select("amount, platform_fee_client, platform_fee_kinglancer, status"),

    serviceDb
      .from("profiles")
      .select(
        "id, email, full_name, role, service_tags, created_at, avatar_url",
      )
      .or("role.is.null,role.neq.admin")
      .order("created_at", { ascending: false })
      .limit(5),

    serviceDb
      .from("jobs")
      .select(
        "id, title, status, budget, categories, created_at, client:profiles!client_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalUsers = usersCountResult.count ?? 0;
  const jobs = jobsResult.data ?? [];
  const openDisputes = (disputesResult.data ?? []) as unknown as AdminDispute[];
  const transactions = transactionsResult.data ?? [];
  const recentUsers = (recentUsersResult.data ?? []) as AdminUser[];
  const recentJobs = (recentJobsResult.data ?? []) as unknown as AdminJob[];

  const activeJobsCount = jobs.filter((job) =>
    ["open", "in_progress"].includes(job.status),
  ).length;
  const completedJobsCount = jobs.filter(
    (job) => job.status === "completed",
  ).length;
  const releasedTransactions = transactions.filter(
    (transaction) => transaction.status === "released",
  );
  const totalProcessed = releasedTransactions.reduce(
    (sum, transaction) =>
      sum + transaction.amount + transaction.platform_fee_client,
    0,
  );
  const platformRevenue = releasedTransactions.reduce(
    (sum, transaction) =>
      sum +
      transaction.platform_fee_client +
      transaction.platform_fee_kinglancer,
    0,
  );

  return (
    <>
      <FadeIn className="mb-8">
        <PageHeader
          eyebrow="Admin"
          title="Admin Overview"
          description={`KingsHire platform · ${new Date().toLocaleDateString(
            "en-GB",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            },
          )}`}
        />
      </FadeIn>

      <Stagger
        className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        staggerDelay={0.07}
      >
        {[
          {
            label: "Marketplace Users",
            value: String(totalUsers),
            sub: `${recentUsers.length} newest shown`,
            icon: Users,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Active Jobs",
            value: String(activeJobsCount),
            sub: `${completedJobsCount} awaiting approval`,
            icon: Briefcase,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Open Disputes",
            value: String(openDisputes.length),
            sub: openDisputes.length > 0 ? "Needs attention" : "All clear",
            icon: AlertCircle,
            color:
              openDisputes.length > 0
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600",
          },
          {
            label: "Total Processed",
            value: totalProcessed > 0 ? formatMoney(totalProcessed) : "£0",
            sub: `${formatMoney(platformRevenue)} platform revenue`,
            icon: TrendingUp,
            color: "bg-purple-50 text-purple-600",
          },
        ].map((stat) => (
          <StaggerItem key={stat.label}>
            <Card interactive className="p-5">
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
              >
                <stat.icon size={18} />
              </div>
              <p className="text-2xl font-black text-slate-950">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{stat.sub}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <FadeIn>
          <AdminPanel
            title="Disputes Snapshot"
            description="Open disputes needing attention."
            count={openDisputes.length}
            tone="red"
          >
            {openDisputes.length === 0 ? (
              <div className="flex items-center gap-3 px-6 py-8 text-sm text-gray-400">
                <CheckCircle size={20} className="text-green-500" />
                No open disputes.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {openDisputes.map((dispute) => (
                  <div key={dispute.id} className="px-5 py-4 sm:px-6">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {dispute.job?.title ?? "Unknown job"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {dispute.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {dispute.job && (
                        <span className="text-sm font-black text-gray-900">
                          {formatMoney(dispute.job.budget)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {timeAgo(dispute.created_at)}
                      </span>
                      {dispute.job && (
                        <Link
                          href={`/jobs/${dispute.job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          <Eye size={13} /> View job
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-red-50 px-5 py-4 sm:px-6">
              <ButtonLink href="/admin/disputes" variant="secondary" size="sm">
                View disputes
              </ButtonLink>
            </div>
          </AdminPanel>
        </FadeIn>

        <FadeIn delay={0.05}>
          <AdminPanel
            title="Recent Users"
            description="Latest marketplace profiles."
            count={recentUsers.length}
          >
            {recentUsers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400">No users yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentUsers.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={profile.full_name || profile.email}
                        src={profile.avatar_url}
                        tone={roleTone(profile.role)}
                        className="h-9 w-9"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">
                          {profile.full_name || "Unnamed user"}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      tone={roleTone(profile.role)}
                      className="capitalize"
                    >
                      {profile.role ?? "onboarding"}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-gray-50 px-5 py-4 sm:px-6">
              <ButtonLink href="/admin/users" variant="secondary" size="sm">
                View users
              </ButtonLink>
            </div>
          </AdminPanel>
        </FadeIn>

        <FadeIn delay={0.1}>
          <AdminPanel
            title="Recent Jobs"
            description="Latest jobs across all statuses."
            count={recentJobs.length}
          >
            {recentJobs.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400">No jobs yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-gray-50 sm:px-6"
                  >
                    <p className="truncate text-sm font-bold text-gray-900">
                      {job.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {job.client?.full_name ?? "Unknown"} ·{" "}
                      {timeAgo(job.created_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobStatusClasses(job.status)}`}
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
            <div className="border-t border-gray-50 px-5 py-4 sm:px-6">
              <ButtonLink href="/admin/jobs" variant="secondary" size="sm">
                View jobs
              </ButtonLink>
            </div>
          </AdminPanel>
        </FadeIn>
      </div>
    </>
  );
}
