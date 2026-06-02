import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FadeIn } from "@/components/animations";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";

export default async function ClientDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [profileResult, jobsResult, transactionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single(),

    supabase
      .from("jobs")
      .select(
        "id, title, status, budget, kinglancer_id, kinglancer:profiles!kinglancer_id(full_name), applications:applications(count)",
      )
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("transactions")
      .select("amount, platform_fee_client, status")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");

  const jobs = (jobsResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    budget: number;
    kinglancer_id: string | null;
    kinglancer: { full_name: string } | null;
    applications: [{ count: number }] | null;
  }>;

  const transactions = transactionsResult.data ?? [];

  const totalSpent = transactions
    .filter((t) => ["held", "released"].includes(t.status))
    .reduce((sum, t) => sum + t.amount + t.platform_fee_client, 0);

  const completedCount = jobs.filter((j) => j.status === "approved").length;

  const awaitingReview = jobs.filter((j) => j.status === "completed");
  const jobsWithApplicants = jobs.filter(
    (j) => j.status === "open" && (j.applications?.[0]?.count ?? 0) > 0,
  );
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress");
  const hasPendingActions =
    awaitingReview.length > 0 || jobsWithApplicants.length > 0;

  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const navItems = getNavItems("client", "/dashboard/client");

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        <FadeIn>
          <h1 className="text-2xl font-black text-gray-900">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Here&apos;s what&apos;s happening with your jobs today.
          </p>
        </FadeIn>

        {/* Needs your attention */}
        <FadeIn>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Needs your attention
          </h2>
          {hasPendingActions ? (
            <div className="space-y-3">
              {awaitingReview.map((job) => (
                <div
                  key={job.id}
                  className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex items-start gap-4"
                >
                  <AlertCircle
                    size={20}
                    className="text-yellow-600 shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-yellow-800">
                      Review completed work
                    </p>
                    <p className="text-yellow-700 text-sm mt-0.5">
                      {job.kinglancer?.full_name ?? "Your Kinglancer"} has
                      marked &quot;{job.title}&quot; as complete. Approve to
                      release payment.
                    </p>
                  </div>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
                  >
                    Review
                  </Link>
                </div>
              ))}
              {jobsWithApplicants.map((job) => {
                const count = job.applications?.[0]?.count ?? 0;
                return (
                  <div
                    key={job.id}
                    className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4"
                  >
                    <Users
                      size={20}
                      className="text-blue-600 shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-blue-800">
                        {count} applicant{count !== 1 ? "s" : ""} on &quot;
                        {job.title}&quot;
                      </p>
                      <p className="text-blue-700 text-sm mt-0.5">
                        Review their proposals and select the best fit.
                      </p>
                    </div>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      View applicants
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-5 py-4">
              <CheckCircle size={18} className="text-green-500 shrink-0" />
              <p className="text-sm text-gray-500">
                You&apos;re all caught up — nothing needs your attention right
                now.
              </p>
            </div>
          )}
        </FadeIn>

        {/* Active work */}
        <FadeIn>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Active work
          </h2>
          {inProgressJobs.length === 0 ? (
            <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-5 py-4">
              <Briefcase size={18} className="text-gray-300 shrink-0" />
              <p className="text-sm text-gray-400">
                {jobs.length === 0 ? (
                  <>
                    No jobs posted yet.{" "}
                    <Link
                      href="/jobs/post"
                      className="text-blue-600 hover:underline"
                    >
                      Post a job
                    </Link>{" "}
                    to get started.
                  </>
                ) : (
                  "No jobs in progress yet — hire a Kinglancer to get the work moving."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {inProgressJobs.map((job) => {
                const initials =
                  job.kinglancer?.full_name
                    ?.split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) ?? "?";
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-blue-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                        {job.title}
                      </p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {job.kinglancer?.full_name ?? "Kinglancer"} · £
                        {Number(job.budget).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                        In progress
                      </span>
                      <ChevronRight
                        size={15}
                        className="text-gray-300 group-hover:text-blue-500 transition-colors"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </FadeIn>

        {/* Numbers */}
        <FadeIn>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Your numbers
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/dashboard/client/transactions"
              className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-green-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-green-500 transition-colors"
                />
              </div>
              <p className="text-2xl font-black text-gray-900">
                {totalSpent > 0 ? `£${totalSpent.toLocaleString()}` : "£0"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Total spent</p>
            </Link>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <CheckCircle size={16} />
              </div>
              <p className="text-2xl font-black text-gray-900">
                {completedCount}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Jobs completed</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </DashboardShell>
  );
}
