import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, TrendingUp, Users, ChevronRight, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FadeIn } from "@/components/animations";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionCentreSummaryCard } from "@/components/dashboard/ActionCentre";
import { getClientActionCounts } from "@/lib/dashboard-action-rules";

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
        "id, title, status, budget, kinglancer_id, invited_kinglancer_id, direct_request_status, kinglancer:profiles!kinglancer_id(full_name), applications:applications(count)",
        { count: "exact" },
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
    invited_kinglancer_id: string | null;
    direct_request_status: string | null;
    kinglancer: { full_name: string } | null;
    applications: [{ count: number }] | null;
  }>;

  const transactions = transactionsResult.data ?? [];

  const totalSpent = transactions
    .filter((t) => ["held", "released"].includes(t.status))
    .reduce((sum, t) => sum + t.amount + t.platform_fee_client, 0);

  const completedCount = jobs.filter((j) => j.status === "approved").length;
  const postedJobsCount = jobsResult.count ?? jobs.length;
  const openJobsCount = jobs.filter((j) => j.status === "open").length;
  const totalApplicantCount = jobs.reduce(
    (sum, job) => sum + (job.applications?.[0]?.count ?? 0),
    0,
  );

  const { actionCount, waitingCount } = getClientActionCounts(
    jobs,
    (job) => job.applications?.[0]?.count ?? 0,
  );
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress");

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

      {/* Action Centre */}
      <FadeIn>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Action Centre
        </h2>
        <ActionCentreSummaryCard
          actionCount={actionCount}
          waitingCount={waitingCount}
          waitingOnLabel="the Kinglancer"
          actionDescription="Review approvals, applicants, requested changes, and escrow payments from one structured page."
        />
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
                  href={`/dashboard/client/jobs/${job.id}`}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/dashboard/client/jobs"
            className="group rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-blue-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-blue-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {postedJobsCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Jobs posted</p>
          </Link>
          <Link
            href="/dashboard/client/jobs"
            className="group rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-emerald-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-emerald-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {openJobsCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Open jobs</p>
          </Link>
          <Link
            href="/dashboard/client/jobs"
            className="group rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 transition-all hover:-translate-y-0.5 hover:border-purple-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={16} />
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-purple-500 transition-colors"
              />
            </div>
            <p className="text-2xl font-black text-slate-950">
              {totalApplicantCount}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">Applicants</p>
          </Link>
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
        </div>
        {completedCount > 0 && (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            {completedCount} completed job{completedCount !== 1 ? "s" : ""}{" "}
            included in your posted jobs.
          </p>
        )}
      </FadeIn>
    </div>
  );
}
