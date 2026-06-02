import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Star,
  ChevronRight,
  TrendingUp,
  Briefcase,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";
import EscrowRow from "./EscrowBanner";
import PayoutSetupButton from "./PayoutSetupButton";
import StripeLoginButton from "./StripeLoginButton";

const APP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-50 text-yellow-700" },
  accepted: { label: "Selected", color: "bg-green-50 text-green-700" },
  rejected: { label: "Not Selected", color: "bg-gray-100 text-gray-500" },
};

const JOB_DISPUTED_STATUS = {
  label: "Disputed",
  color: "bg-red-50 text-red-600",
};

export default async function KinglancerDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [profileResult, applicationsResult, transactionsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, avatar_url, role, rating, jobs_completed, stripe_account_id, stripe_onboarding_complete",
        )
        .eq("id", user.id)
        .single(),

      supabase
        .from("applications")
        .select(
          "id, status, cover_letter, created_at, job:jobs(id, title, budget, status, deadline, client_id)",
        )
        .eq("kinglancer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),

      supabase
        .from("transactions")
        .select("amount, platform_fee_kinglancer, status, job_id")
        .eq("kinglancer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");
  if (profile.role === "client") redirect("/dashboard/client");

  const applications = (applicationsResult.data ?? []) as Array<{
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

  const transactions = transactionsResult.data ?? [];

  // Derived stats
  const totalEarned = transactions
    .filter((t) => t.status === "released")
    .reduce((sum, t) => sum + (t.amount - t.platform_fee_kinglancer), 0);

  const activeJobsCount = applications.filter(
    (a) => a.status === "accepted" && a.job?.status === "in_progress",
  ).length;

  // Active in_progress jobs with held escrow — show as banner(s)
  const escrowJobs = applications.filter(
    (a) =>
      a.status === "accepted" &&
      a.job &&
      ["in_progress", "completed"].includes(a.job.status),
  );

  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const navItems = getNavItems("kinglancer", "/dashboard/kinglancer");

  const stats = [
    {
      label: "Total Earned",
      value: totalEarned > 0 ? `£${totalEarned.toFixed(0)}` : "£0",
      icon: TrendingUp,
      color: "bg-green-50 text-green-600",
      href: null,
    },
    {
      label: "Active Jobs",
      value: String(activeJobsCount),
      icon: Briefcase,
      color: "bg-blue-50 text-blue-600",
      href: "/jobs",
    },
    {
      label: "Completed",
      value: String(profile.jobs_completed),
      icon: CheckCircle,
      color: "bg-purple-50 text-purple-600",
      href: null,
    },
    {
      label: "Rating",
      value:
        profile.jobs_completed > 0 ? Number(profile.rating).toFixed(1) : "—",
      icon: Star,
      color: "bg-yellow-50 text-yellow-600",
      href: "/dashboard/profile",
    },
  ];

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <FadeIn className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeJobsCount > 0
              ? `You have ${activeJobsCount} active contract${activeJobsCount !== 1 ? "s" : ""}.`
              : "No active contracts. Browse jobs to find your next opportunity."}
          </p>
        </FadeIn>

        {/* Payout connection status */}
        <FadeIn className="mb-6">
          {profile.stripe_onboarding_complete ? (
            <div className="flex items-start gap-4 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <CheckCircle
                size={20}
                className="text-green-600 shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-green-900 text-sm">
                  Your personal payout account is active
                </p>
                <p className="text-green-700 text-sm mt-0.5">
                  When a client approves your work, KingsHire transfers your
                  earnings directly to the bank account you registered. The
                  Stripe dashboard is your personal earnings record — it shows
                  your balance, upcoming payouts, and transaction history.
                </p>
              </div>
              <StripeLoginButton />
            </div>
          ) : (
            <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <AlertCircle
                size={20}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 text-sm">
                  Connect your bank account to receive earnings
                </p>
                <p className="text-amber-700 text-sm mt-0.5">
                  KingsHire uses Stripe to pay you securely. Set up your
                  personal payout account once — after that, every approved
                  payment goes straight to your bank automatically. Takes less
                  than 2 minutes.
                </p>
              </div>
              <PayoutSetupButton />
            </div>
          )}
        </FadeIn>

        {/* Active contracts — summary card */}
        {escrowJobs.length > 0 &&
          (() => {
            const totalEscrow = escrowJobs.reduce((sum, app) => {
              if (!app.job) return sum;
              const tx = transactions.find((t) => t.job_id === app.job!.id);
              return (
                sum +
                (tx
                  ? app.job.budget - tx.platform_fee_kinglancer
                  : app.job.budget * 0.95)
              );
            }, 0);
            return (
              <FadeIn className="mb-6">
                <div className="rounded-2xl overflow-hidden border border-white/5">
                  {/* Summary header */}
                  <div className="bg-linear-to-r from-[#0f172a] to-[#1e3a7a] px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">
                        Active Contracts
                        <span className="ml-2 text-white/40 font-normal">
                          {escrowJobs.length} job
                          {escrowJobs.length !== 1 ? "s" : ""} in progress
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs">total in escrow</p>
                      <p className="text-white font-black text-lg leading-none mt-0.5">
                        £{totalEscrow.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {/* Individual rows */}
                  <div className="bg-[#0f172a] divide-y divide-white/5">
                    {escrowJobs.map((app) => {
                      if (!app.job) return null;
                      const isDone = app.job.status === "completed";
                      const escrowTx = transactions.find(
                        (t) => t.job_id === app.job!.id,
                      );
                      const heldAmount = escrowTx
                        ? app.job.budget - escrowTx.platform_fee_kinglancer
                        : app.job.budget * 0.95;
                      return (
                        <EscrowRow
                          key={app.id}
                          jobId={app.job.id}
                          jobTitle={app.job.title}
                          heldAmount={heldAmount}
                          deadline={app.job.deadline}
                          isDone={isDone}
                        />
                      );
                    })}
                  </div>
                </div>
              </FadeIn>
            );
          })()}

        {/* Stats */}
        <Stagger
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          staggerDelay={0.07}
        >
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              {stat.href ? (
                <Link
                  href={stat.href}
                  className="block bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                </Link>
              ) : (
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <div
                    className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                </div>
              )}
            </StaggerItem>
          ))}
        </Stagger>

        {/* Applications list */}
        <FadeIn className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">My Applications</h2>
            <Link
              href="/jobs"
              className="text-sm text-blue-600 hover:underline"
            >
              Browse more jobs
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <DollarSign size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No applications yet.</p>
              <Link
                href="/jobs"
                className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Browse open jobs
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {applications.map((app) => {
                if (!app.job) return null;
                const isDisputed = app.job.status === "disputed";
                const s = isDisputed
                  ? JOB_DISPUTED_STATUS
                  : (APP_STATUS[app.status] ?? APP_STATUS.pending);
                return (
                  <Link
                    key={app.id}
                    href={`/jobs/${app.job.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                        {app.job.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
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
                      <span className="font-bold text-gray-900">
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
        </FadeIn>
      </div>
    </DashboardShell>
  );
}
