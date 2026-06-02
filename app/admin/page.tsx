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
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import SignOutButton from "@/components/SignOutButton";

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

  // Admin gate — check against ADMIN_EMAILS env var
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Fail closed: if ADMIN_EMAILS is not configured, deny access in production.
  // In dev without a list configured, allow through for convenience.
  if (adminEmails.length === 0) {
    if (process.env.NODE_ENV === "production") redirect("/");
  } else if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    redirect("/");
  }

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

  const initials = user.email?.[0]?.toUpperCase() ?? "A";

  const JOB_STATUS_COLORS: Record<string, string> = {
    open: "bg-green-50 text-green-700",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-yellow-50 text-yellow-700",
    disputed: "bg-red-50 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-[#0f172a] flex-col z-40">
        <div className="p-6 border-b border-white/5">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={120}
              height={36}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <span className="mt-2 inline-block bg-red-500/20 text-red-400 text-xs font-semibold px-2 py-0.5 rounded-md">
            Admin
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: "Overview", icon: "📊", href: "/admin" },
            { label: "Users", icon: "👥", href: "/admin" },
            { label: "Jobs", icon: "💼", href: "/admin" },
            { label: "Disputes", icon: "🚨", href: "/admin" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-white/50 hover:text-white hover:bg-white/5 first:bg-blue-600 first:text-white"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user.email}
              </p>
              <p className="text-white/40 text-xs">Super Admin</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0f172a] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={110}
              height={32}
              className="h-7 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        <SignOutButton />
      </div>

      {/* Main */}
      <div className="lg:pl-64">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <FadeIn className="mb-8">
            <h1 className="text-2xl font-black text-gray-900">
              Admin Overview
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              KingsHire platform ·{" "}
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
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
                <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                  <div
                    className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Open Disputes */}
          <FadeIn className="bg-white rounded-2xl border border-red-100 overflow-hidden mb-6">
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
                          <Eye size={14} /> Review
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
            <FadeIn className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Recent Sign-ups</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {recentUsers.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-400">
                    No users yet.
                  </p>
                ) : (
                  recentUsers.map((u) => {
                    const initials = u.full_name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    const avatarColor =
                      u.role === "kinglancer"
                        ? "bg-linear-to-br from-green-500 to-emerald-600"
                        : false
                          ? "bg-linear-to-br from-purple-500 to-indigo-600"
                          : "bg-linear-to-br from-blue-500 to-indigo-600";
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0`}
                          >
                            {u.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={u.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>
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
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              u.role === "kinglancer"
                                ? "bg-green-50 text-green-700"
                                : false
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {u.role}
                          </span>
                          <span className="text-xs text-gray-400 hidden sm:block">
                            {timeAgo(u.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </FadeIn>

            {/* Recent jobs */}
            <FadeIn className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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

const stats = [
  {
    label: "Total Users",
    value: "142",
    sub: "+12 this week",
    icon: Users,
    color: "bg-blue-50 text-blue-600",
  },
  {
    label: "Active Jobs",
    value: "38",
    sub: "11 awaiting hire",
    icon: Briefcase,
    color: "bg-green-50 text-green-600",
  },
  {
    label: "Open Disputes",
    value: "2",
    sub: "Needs attention",
    icon: AlertCircle,
    color: "bg-red-50 text-red-600",
  },
  {
    label: "Completed Jobs",
    value: "94",
    sub: "£14,200 processed",
    icon: TrendingUp,
    color: "bg-purple-50 text-purple-600",
  },
];

const disputes = [
  {
    id: 1,
    job: "Deep cleaning — 3 bed house",
    client: "Sister Joy",
    kinglancer: "Chidinma A.",
    amount: 120,
    raised: "2h ago",
    status: "open",
  },
  {
    id: 2,
    job: "Photography — wedding event",
    client: "Deacon Bola",
    kinglancer: "Grace M.",
    amount: 350,
    raised: "1d ago",
    status: "investigating",
  },
];

const recentUsers = [
  {
    name: "Favour Nwosu",
    role: "Kinglancer",
    joined: "1h ago",
    skills: "Tutoring",
  },
  { name: "Mrs Adeyemi", role: "Client", joined: "3h ago", skills: "—" },
  {
    name: "Joshua Eze",
    role: "Kinglancer",
    joined: "5h ago",
    skills: "Plumbing",
  },
  { name: "Sis Chioma", role: "Client", joined: "1d ago", skills: "—" },
];
