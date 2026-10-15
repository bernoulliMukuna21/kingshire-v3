export const dynamic = "force-dynamic";

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
import AdminUserPhone from "@/components/admin/AdminUserPhone";
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
  requireAdminPage,
  roleTone,
  timeAgo,
} from "@/lib/admin-dashboard";
import { formatMoneyPrecise as formatMoney } from "@/lib/utils";
import { jobPriceLabel } from "@/lib/jobs";
import { jobStatusPill } from "@/lib/jobs";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import { collectPages } from "@/lib/db/pagination";
import { getAdminStripeActivity } from "@/lib/admin-stripe-financials";
import { deriveAdminFinancials } from "@/lib/admin-financials";

export default async function AdminDashboard() {
  await requireAdminPage();
  const serviceDb = createServiceClient();

  const [
    usersCountResult,
    jobsResult,
    disputesResult,
    transactionsResult,
    recentUsersResult,
    recentJobsResult,
    stripeBalanceResult,
    engagementPayments,
    stripeActivity,
  ] = await Promise.all([
    serviceDb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or("role.is.null,role.neq.admin"),

    serviceDb.from("jobs").select("id, status"),

    serviceDb
      .from("disputes")
      .select(
        "id, reason, created_at, status, raised_by, job:jobs!job_id(id, title, budget, posting_type, pay_negotiable, pay_amount, pay_cadence, client_id, kinglancer_id)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),

    collectPages((from, to) => serviceDb
      .from("transactions")
      .select("amount, platform_fee_client, platform_fee_kinglancer, status, payment_method, manual_payout_reference, stripe_transfer_id, stripe_refund_id, release_outcome")
      .order("id").range(from, to)).catch((error) => {
        console.error("[admin financials] transactions", error);
        return null;
      }),

    serviceDb
      .from("profiles")
      .select(
        "id, email, phone, full_name, role, service_tags, created_at, avatar_url",
      )
      .or("role.is.null,role.neq.admin")
      .order("created_at", { ascending: false })
      .limit(5),

    serviceDb
      .from("jobs")
      .select(
        "id, title, status, budget, posting_type, pay_negotiable, pay_amount, pay_cadence, categories, created_at, client:profiles!client_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(5),

    stripe.balance.retrieve().catch((error) => {
      console.error("[admin financials] Stripe balance", error);
      return null;
    }),
    collectPages((from, to) => serviceDb
      .from("engagement_payments")
      .select("worker_amount, platform_fee_client, platform_fee_kinglancer, status, stripe_transfer_id, stripe_refund_id, release_outcome")
      .order("id").range(from, to)).catch((error) => {
        console.error("[admin financials] engagements", error);
        return null;
      }),
    getAdminStripeActivity().catch((error) => {
      console.error("[admin financials] Stripe activity", error);
      return null;
    }),
  ]);

  const totalUsers = usersCountResult.count ?? 0;
  const jobs = jobsResult.data ?? [];
  const openDisputes = (disputesResult.data ?? []) as unknown as AdminDispute[];
  const recentUsers = (recentUsersResult.data ?? []) as AdminUser[];
  const recentJobs = (recentJobsResult.data ?? []) as unknown as AdminJob[];

  const stripeAvailablePence = stripeBalanceResult
    ? (stripeBalanceResult.available.find((b) => b.currency === "gbp")?.amount ?? 0)
    : null;
  const stripeAvailableGBP = stripeAvailablePence === null ? null : stripeAvailablePence / 100;
  const stripePendingGBP = (stripeBalanceResult?.pending.find((b) => b.currency === "gbp")?.amount ?? 0) / 100;
  let financials: ReturnType<typeof deriveAdminFinancials> = null;
  try {
    financials = deriveAdminFinancials({
      transactions: transactionsResult,
      engagementPayments,
      stripeAvailablePence,
      stripeActivity,
    });
  } catch (error) {
    console.error("[admin financials] invalid ledger", error);
  }
  const moneyOrUnavailable = (value: number | null | undefined) =>
    value == null ? "Unavailable" : formatMoney(value);

  const activeJobsCount = jobs.filter((job) =>
    ["open", "in_progress"].includes(job.status),
  ).length;
  const completedJobsCount = jobs.filter(
    (job) => job.status === "completed",
  ).length;

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
            label: "Released One-off Payments",
            value: moneyOrUnavailable(financials?.totalProcessedGBP),
            sub: financials ? `${formatMoney(financials.platformFeesGBP)} released one-off fees` : "Financial data unavailable",
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

      {/* ── Platform Financials ── */}
      <FadeIn className="mb-6">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">
                Platform Financials
              </p>
              <p className="text-xs text-slate-400">
                Revenue, costs and funds held for workers
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-6 text-white sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/10" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Platform cash available
                </p>
                <p className="mt-3 break-words text-5xl font-black tracking-tight tabular-nums sm:text-6xl" aria-live="polite">
                  {moneyOrUnavailable(financials?.estimatedWithdrawableGBP)}
                </p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-emerald-100">
                  After reserving held client payments. Stripe fees already deducted are reflected in this balance.
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                <p className="font-semibold text-white">Current cash position</p>
                <p className="mt-1 text-xs text-emerald-100">Updated when this page loads</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Stripe available", value: stripeAvailableGBP,
                detail: stripePendingGBP > 0 ? `${formatMoney(stripePendingGBP)} still settling` : "Settled Stripe balance" },
              { label: "Worker funds held", value: financials?.stripeOwedGBP,
                detail: "Stripe-funded work awaiting payout" },
              { label: "Job-fee revenue", value: financials?.platformFeesGBP,
                detail: "Released job fees before costs; excludes subscriptions" },
              { label: "Lifetime net earnings", value: financials?.platformNetProceedsGBP,
                detail: "Includes subscriptions; after Stripe costs, before tax and other expenses" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{moneyOrUnavailable(metric.value)}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{metric.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Recorded Stripe costs, lifetime: <strong>{moneyOrUnavailable(financials?.stripeCostsGBP)}</strong>. These have already been deducted from Stripe cash.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {financials
              ? `${financials.bankOwedGBP > 0 ? `${formatMoney(financials.bankOwedGBP)} additional unpaid worker funds are recorded as bank-funded; check against bank records.` : "No outstanding bank-funded worker payouts."} Stripe reserves include ${formatMoney(financials.deferredStripeFeesGBP)} in held fees. Completed manual payouts are not outstanding debts.`
              : "Payment records could not be verified. Financial estimates unavailable."}
            {" "}Net proceeds are before tax and other business expenses. Cash after reserves is not profit or a guarantee of safe withdrawal; pending funds, top-ups and earlier withdrawals affect the balance.
            {financials?.needsReconciliation && " A settlement or Stripe movement needs reconciliation; estimates are unavailable."}
          </p>
        </Card>
      </FadeIn>

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
                          {jobPriceLabel(dispute.job)}
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
                        <AdminUserPhone phone={profile.phone} />
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
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobStatusPill(job.status).className}`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-black text-gray-900">
                        {jobPriceLabel(job)}
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
