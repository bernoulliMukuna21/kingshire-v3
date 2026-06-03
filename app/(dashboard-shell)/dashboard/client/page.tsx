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
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

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

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Greeting */}
        <FadeIn>
          <PageHeader
            eyebrow="Client dashboard"
            title={`Welcome back, ${firstName} 👋`}
            description="Track your posted jobs, review applicants, and release payments from one place."
            action={
              <ButtonLink href="/jobs/post" variant="secondary">
                Post a job
              </ButtonLink>
            }
          />
        </FadeIn>

        {/* Needs your attention */}
        <FadeIn>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Needs your attention
          </h2>
          {hasPendingActions ? (
            <div className="space-y-3">
              {awaitingReview.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-lg shadow-amber-900/5 sm:flex-row sm:items-start"
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
                    className="shrink-0 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
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
                    className="flex flex-col gap-4 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 shadow-lg shadow-blue-900/5 sm:flex-row sm:items-start"
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
                      className="shrink-0 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      View applicants
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="flex items-center gap-3 px-5 py-4">
              <CheckCircle size={18} className="text-green-500 shrink-0" />
              <p className="text-sm text-slate-500">
                You&apos;re all caught up — nothing needs your attention right
                now.
              </p>
            </Card>
          )}
        </FadeIn>

        {/* Active work */}
        <FadeIn>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Active work
          </h2>
          {inProgressJobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={22} />}
              title={jobs.length === 0 ? "No jobs posted yet" : "No active work"}
              description={
                jobs.length === 0
                  ? "Post your first job to start receiving proposals from Kinglancers."
                  : "Hire a Kinglancer to get the work moving."
              }
              action={
                jobs.length === 0 ? (
                  <ButtonLink href="/jobs/post" size="sm">
                    Post a job
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <div className="space-y-2">
              {inProgressJobs.map((job) => {
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group flex items-center gap-4 rounded-[1.5rem] border border-white bg-white/90 px-5 py-4 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-blue-950/10"
                  >
                    <Avatar name={job.kinglancer?.full_name} tone="green" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-950 group-hover:text-blue-700 transition-colors truncate">
                        {job.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {job.kinglancer?.full_name ?? "Kinglancer"} · £
                        {Number(job.budget).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge>In progress</StatusBadge>
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Your numbers
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/dashboard/client/transactions"
              className="group rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-emerald-100"
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
              <p className="text-2xl font-black text-slate-950">
                {totalSpent > 0 ? `£${totalSpent.toLocaleString()}` : "£0"}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Total spent</p>
            </Link>
            <Card className="p-5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <CheckCircle size={16} />
              </div>
              <p className="text-2xl font-black text-slate-950">
                {completedCount}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Jobs completed</p>
            </Card>
          </div>
        </FadeIn>
    </div>
  );
}
