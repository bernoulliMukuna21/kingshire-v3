import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Briefcase,
  AlertCircle,
  TrendingUp,
  Eye,
  CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession, isAdminEmail } from "@/lib/admin-auth";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import SignOutButton from "@/components/SignOutButton";
import { Card } from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type DisputeRow = {
  id: string;
  reason: string;
  created_at: string;
  status: string;
  raised_by: string;
  job: {
    id: string;
    title: string;
    budget: number;
    client_id: string;
    kinglancer_id: string | null;
  } | null;
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  if (!isAdminEmail(user.email)) redirect("/");
  if (!(await hasValidAdminSession(user.id))) redirect("/admin/login");

  // Use the service client for all data queries so RLS does not hide records.
  const serviceDb = createServiceClient();

  const [
    usersCountResult,
    jobsResult,
    disputesResult,
    transactionsResult,
    recentUsersResult,
    recentJobsResult,
  ] = await Promise.all([
    serviceDb.from("profiles").select("id", { count: "exact", head: true }),

    serviceDb.from("jobs").select("id, status"),

    serviceDb
      .from("disputes")
      .select(
        "id, reason, created_at, status, raised_by, job:jobs!job_id(id, title, budget, client_id, kinglancer_id)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false }),

    serviceDb
      .from("transactions")
      .select("amount, platform_fee_client, platform_fee_kinglancer, status"),

    serviceDb
      .from("profiles")
      .select("id, full_name, role, skills, created_at, avatar_url")
      .order("created_at", { ascending: false })
      .limit(8),

    serviceDb
      .from("jobs")
      .select(
        "id, title, status, budget, created_at, client:profiles!client_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const totalUsers = usersCountResult.count ?? 0;
  const jobs = jobsResult.data ?? [];
  const disputes = (disputesResult.data ?? []) as unknown as DisputeRow[];
  const transactions = transactionsResult.data ?? [];
  const recentUsers = recentUsersResult.data ?? [];
  const recentJobs = (recentJobsResult.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: string;
    budget: number;
    created_at: string;
    client: { full_name: string } | null;
  }>;

  const activeJobsCount = jobs.filter((j) =>
    ["open", "in_progress"].includes(j.status),
  ).length;
  const completedJobsCount = jobs.filter(
    (j) => j.status === "completed",
  ).length;
  const releasedTransactions = transactions.filter(
    (t) => t.status === "released",
  );
  const totalProcessed = releasedTransactions.reduce(
    (sum, t) => sum + t.amount + t.platform_fee_client,
    0,
  );
  const platformRevenue = releasedTransactions.reduce(
    (sum, t) => sum + t.platform_fee_client + t.platform_fee_kinglancer,
    0,
  );

  const JOB_STATUS_COLORS: Record<string, string> = {
    open: "bg-green-50 text-green-700",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-yellow-50 text-yellow-700",
    disputed: "bg-red-50 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff_0,#f8fafc_34%,#f1f5f9_100%)] text-slate-900">
      {/* Sidebar */}
      <div className="hidden lg:flex fixed top-0 left-0 bottom-0 w-72 bg-[#10234b] flex-col z-40 shadow-2xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)] pointer-events-none" />
        <div className="relative p-6 border-b border-white/10">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={137}
              height={36}
              className="h-9 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <span className="mt-4 inline-block rounded-full bg-red-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-200 ring-1 ring-red-300/20">
            Admin
          </span>
        </div>
        <nav className="relative flex-1 p-4 space-y-1.5">
          {[
            { label: "Overview", icon: "📊", href: "/admin" },
            { label: "Users", icon: "👥", href: "/admin" },
            { label: "Jobs", icon: "💼", href: "/admin" },
            { label: "Disputes", icon: "🚨", href: "/admin" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all text-white/55 hover:text-white hover:bg-white/10 first:bg-white first:text-[#10234b] first:shadow-lg first:shadow-slate-950/15"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="relative p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <Avatar name={user.email} tone="red" className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.email}
              </p>
              <p className="text-white/40 text-xs">Super Admin</p>
            </div>
          </div>
          <SignOutButton className="w-full" />
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#10234b]/95 shadow-xl shadow-slate-950/15 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={122}
              height={32}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        <SignOutButton className="px-4 py-2 text-xs" />
      </div>

      {/* Main */}
      <div className="lg:pl-72">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
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

          {/* Stats */}
          <Stagger
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            staggerDelay={0.07}
          >
            {[
              {
                label: "Total Users",
                value: String(totalUsers),
                sub: `${recentUsers.length} recent sign-ups`,
                icon: Users,
                color: "bg-blue-50 text-blue-600",
              },
              {
                label: "Active Jobs",
                value: String(activeJobsCount),
                sub: `${completedJobsCount} awaiting review`,
                icon: Briefcase,
                color: "bg-green-50 text-green-600",
              },
              {
                label: "Open Disputes",
                value: String(disputes.length),
                sub: disputes.length > 0 ? "Needs attention" : "All clear",
                icon: AlertCircle,
                color:
                  disputes.length > 0
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-600",
              },
              {
                label: "Total Processed",
                value:
                  totalProcessed > 0 ? `£${totalProcessed.toFixed(0)}` : "£0",
                sub: `£${platformRevenue.toFixed(0)} platform revenue`,
                icon: TrendingUp,
                color: "bg-purple-50 text-purple-600",
              },
            ].map((stat) => (
              <StaggerItem key={stat.label}>
                <Card interactive className="p-5">
                  <div
                    className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-slate-950">
                    {stat.value}
                  </p>
                  <p className="text-slate-500 text-sm">{stat.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Open Disputes */}
          <FadeIn className="mb-6 overflow-hidden rounded-[1.75rem] border border-red-100 bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-red-100/60">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-red-50 bg-red-50">
              <AlertCircle size={16} className="text-red-600" />
              <h2 className="font-bold text-red-900">Open Disputes</h2>
              <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {disputes.length} open
              </span>
            </div>
            {disputes.length === 0 ? (
              <div className="flex items-center gap-3 px-6 py-8 text-gray-400">
                <CheckCircle size={20} className="text-green-500" />
                <p className="text-sm">No open disputes — all clear.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {disputes.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {d.job?.title ?? "Unknown job"}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {d.reason}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Raised {timeAgo(d.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {d.job && (
                        <span className="font-bold text-gray-900">
                          £{Number(d.job.budget).toLocaleString()}
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        Needs Review
                      </span>
                      {d.job && (
                        <Link
                          href={`/jobs/${d.job.id}`}
                          className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
                        >
                          <Eye size={14} /> View job
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FadeIn>

          {/* Recent sign-ups + Recent jobs side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent users */}
            <FadeIn className="overflow-hidden rounded-[1.75rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Recent Sign-ups</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recentUsers.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-400">
                    No users yet.
                  </p>
                ) : (
                  recentUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={u.full_name}
                          src={u.avatar_url}
                          tone={u.role === "kinglancer" ? "green" : "blue"}
                          className="h-8 w-8 rounded-xl text-xs"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {u.full_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {u.skills?.length > 0
                              ? u.skills[0]
                              : "Client account"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge
                          tone={u.role === "kinglancer" ? "green" : "blue"}
                          className="capitalize"
                        >
                          {u.role}
                        </StatusBadge>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {timeAgo(u.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </FadeIn>

            {/* Recent jobs */}
            <FadeIn className="overflow-hidden rounded-[1.75rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Recent Jobs</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recentJobs.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-400">
                    No jobs yet.
                  </p>
                ) : (
                  recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">
                          {job.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {job.client?.full_name ?? "Unknown"} ·{" "}
                          {timeAgo(job.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-500"}`}
                        >
                          {job.status.replace("_", " ")}
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          £{Number(job.budget).toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
