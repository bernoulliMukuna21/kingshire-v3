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

  const [
    profileResult,
    applicationsResult,
    transactionsResult,
    directRequestsResult,
  ] =
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

      supabase
        .from("jobs")
        .select(
          "id, title, budget, rate_type, status, deadline, direct_request_status, direct_request_message, counter_budget, counter_rate_type, counter_deadline, client:profiles!client_id(full_name)",
        )
        .eq("invited_kinglancer_id", user.id)
        .in("direct_request_status", [
          "pending",
          "changes_requested",
          "accepted_pending_payment",
        ])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

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
  const directRequests = (directRequestsResult.data ?? []) as Array<{
    id: string;
    title: string;
    budget: number;
    rate_type: string;
    status: string;
    deadline: string | null;
    direct_request_status: string | null;
    direct_request_message: string | null;
    counter_budget: number | null;
    counter_rate_type: string | null;
    counter_deadline: string | null;
    client: { full_name: string } | null;
  }>;

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <FadeIn className="relative mb-6 overflow-hidden rounded-[2rem] bg-[#10234b] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_34%)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-100 ring-1 ring-white/15">
                Kinglancer dashboard
              </span>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Welcome back, {firstName} 👋
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
                {activeJobsCount > 0
                  ? `You have ${activeJobsCount} active contract${activeJobsCount !== 1 ? "s" : ""}. Keep delivery moving and track every payout from here.`
                  : "No active contracts right now. Browse open jobs and turn your next application into paid work."}
              </p>
            </div>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#10234b] shadow-xl shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:bg-sky-50"
            >
              Browse jobs
              <ChevronRight size={16} className="ml-1" />
            </Link>
          </div>
        </FadeIn>

        {/* Payout connection status */}
        <FadeIn className="mb-6">
          {profile.stripe_onboarding_complete ? (
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-emerald-200/80 bg-emerald-50/90 p-5 shadow-lg shadow-emerald-900/5 ring-1 ring-white sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <CheckCircle size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black text-emerald-950">
                    Your personal payout account is active
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    When a client approves your work, KingsHire transfers your
                    earnings directly to the bank account you registered. The
                    Stripe dashboard shows balances, upcoming payouts, and
                    transaction history.
                  </p>
                </div>
              </div>
              <StripeLoginButton />
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-amber-200/80 bg-amber-50/90 p-5 shadow-lg shadow-amber-900/5 ring-1 ring-white sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
                  <AlertCircle size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black text-amber-950">
                    Connect your bank account to receive earnings
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    KingsHire uses Stripe to pay you securely. Set up your
                    personal payout account once — after that, every approved
                    payment goes straight to your bank automatically.
                  </p>
                </div>
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
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 shadow-2xl shadow-blue-950/10">
                  {/* Summary header */}
                  <div className="flex items-center justify-between bg-linear-to-r from-[#0f172a] to-[#1e3a7a] px-5 py-4">
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

        {directRequests.length > 0 && (
          <FadeIn className="mb-6 overflow-hidden rounded-[1.75rem] border border-blue-100 bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-black text-slate-950">Direct Requests</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Private job requests sent specifically to you
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {directRequests.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950 transition-colors group-hover:text-blue-700">
                      {job.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {job.client?.full_name ?? "Client"} · £
                      {Number(job.budget).toLocaleString()}{" "}
                      {job.rate_type === "fixed"
                        ? "fixed"
                        : job.rate_type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 sm:inline">
                      {job.direct_request_status === "accepted_pending_payment"
                        ? "Accepted"
                        : job.direct_request_status === "changes_requested"
                          ? "Changes requested"
                          : "New request"}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 transition-colors group-hover:text-blue-500"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Stats */}
        <Stagger
          className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
          staggerDelay={0.07}
        >
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              {stat.href ? (
                <Link
                  href={stat.href}
                  className="group block rounded-[1.5rem] border border-white bg-white/85 p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/10"
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${stat.color} transition-transform group-hover:scale-105`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-slate-950">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>
                </Link>
              ) : (
                <div className="rounded-[1.5rem] border border-white bg-white/85 p-5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${stat.color}`}
                  >
                    <stat.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-slate-950">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>
                </div>
              )}
            </StaggerItem>
          ))}
        </Stagger>

        {/* Applications list */}
        <FadeIn className="overflow-hidden rounded-[1.75rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
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
                    href={`/jobs/${app.job.id}`}
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
        </FadeIn>
    </div>
  );
}
