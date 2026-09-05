import { notFound, redirect } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CreditCard,
  Phone,
  Tag,
  UserRound,
} from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getApplicationsByJob } from "@/lib/db/applications";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import { getJobById } from "@/lib/db/jobs";
import { getPendingPaymentAttemptByJob } from "@/lib/db/payment-attempts";
import { jobStatusPill } from "@/lib/jobs";
import { getJobPaymentPolicy } from "@/lib/payments/policy";
import type { RateType, WorkMode, DirectRequestStatus } from "@/lib/jobs";
import {
  getJobReviewState,
  isReviewWindowClosed,
  reviewWindowRemaining,
  REVIEW_WINDOW_DAYS,
} from "@/lib/db/reviews";
import { getTransactionByJob } from "@/lib/db/transactions";
import { formatMoney, formatRateType, formatDeadline } from "@/lib/utils";
import {
  ApplicantsList,
  ClientApproveActions,
  DirectRequestActions,
} from "@/app/jobs/[id]/JobActions";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card, cardPadding } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import DashboardBackLink from "@/components/dashboard/DashboardBackLink";
import ReviewPanel from "@/components/jobs/ReviewPanel";
import CancelJobButton from "@/app/(dashboard-shell)/dashboard/client/jobs/[id]/CancelJobButton";
import PendingPaymentCard from "@/app/(dashboard-shell)/dashboard/client/jobs/[id]/PendingPaymentCard";
import RepostJobButton from "@/app/(dashboard-shell)/dashboard/client/jobs/[id]/RepostJobButton";
import { canManageJob } from "@/lib/organisations";

type InvitedKinglancer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
};

function getCounterRateType(value: string | null): RateType | null {
  if (value === "fixed" || value === "per_hour" || value === "per_day") {
    return value;
  }
  return null;
}

export default async function JobDetailWorkspace({
  jobId: id,
  from,
  paymentFailed: payment_failed,
  organisationId,
  header,
}: {
  jobId: string;
  from?: string;
  paymentFailed?: string;
  // When rendered inside an org workspace, restrict the job to that org and
  // frame navigation around it.
  organisationId?: string;
  header?: React.ReactNode;
}) {
  // getDashboardContext is React-cached — reuses the result already fetched
  // by the layout with zero extra DB round trips.
  const [{ supabase, user, profile }, job] = await Promise.all([
    getDashboardContext(),
    getJobById(id, { useServiceRole: true }),
  ]);

  if (!job) notFound();
  if (organisationId && job.organisation_id !== organisationId) notFound();
  const canManage = await canManageJob(job, user.id);
  if (!canManage) {
    if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
    if (profile.role !== "client") redirect("/onboarding");
    notFound();
  }

  // Navigation frames around the job's owner: org jobs return to the org jobs
  // list, personal jobs to My Jobs.
  const jobsListHref = job.organisation_id
    ? `/dashboard/organisations/${job.organisation_id}/jobs`
    : "/dashboard/client/jobs";
  const jobsListLabel = job.organisation_id
    ? "Back to jobs"
    : "Back to My Jobs";

  const isDirectRequest = !!job.invited_kinglancer_id;
  const statusConfig = jobStatusPill(job.status);
  const kinglancerProfileId = job.kinglancer_id ?? job.invited_kinglancer_id;

  const [applications, kinglancerResult, pendingAttempt] = await Promise.all([
    !isDirectRequest && job.status === "open"
      ? getApplicationsByJob(id, { useServiceRole: !!job.organisation_id })
      : Promise.resolve([] as ApplicationWithKinglancer[]),
    kinglancerProfileId
      ? supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone")
          .eq("id", kinglancerProfileId)
          .single()
      : Promise.resolve({ data: null }),
    job.status === "open"
      ? getPendingPaymentAttemptByJob(id)
      : Promise.resolve(null),
  ]);

  // A pending payment locks selection and editing until it clears/cancels.
  const paymentPending = !!pendingAttempt;
  // Card (Stripe) funding needs an active subscription; org jobs are covered.
  const cardEnabled =
    job.status === "open" ? (await getJobPaymentPolicy(job)).cardAllowed : true;
  // Held rail for an in-progress job — bank_transfer refunds route to support.
  const heldPaymentMethod =
    job.status === "in_progress"
      ? (((await getTransactionByJob(id))?.payment_method ?? null) as
          | "card"
          | "bank_transfer"
          | null)
      : null;

  const kinglancer = kinglancerResult.data as InvitedKinglancer | null;
  const kinglancerName = kinglancerProfileId
    ? (kinglancer?.full_name ?? "Selected Kinglancer")
    : null;
  // Contact details are shared only once the worker is actually hired.
  const contactRevealed = !!job.kinglancer_id;
  const categories = job.categories ?? [];
  const deadline = formatDeadline(job.deadline);

  // Review state for approved jobs (double-blind, 7-day window).
  let reviewState: Awaited<ReturnType<typeof getJobReviewState>> | null = null;
  let reviewWindowClosed = false;
  let reviewRemaining: ReturnType<typeof reviewWindowRemaining> = null;
  if (job.status === "approved") {
    const [state, tx] = await Promise.all([
      getJobReviewState(id, user.id),
      getTransactionByJob(id),
    ]);
    reviewState = state;
    reviewWindowClosed = isReviewWindowClosed(tx?.released_at ?? null);
    const closesAt = tx?.released_at
      ? new Date(
          new Date(tx.released_at).getTime() +
            REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;
    reviewRemaining = reviewWindowRemaining(closesAt);
  }
  const kinglancerFirstName =
    kinglancer?.full_name?.split(" ")[0] ?? "the Kinglancer";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {header}
      <DashboardBackLink
        source={from}
        fallbackHref={jobsListHref}
        fallbackLabel={jobsListLabel}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {payment_failed === "1" && (
            <Card className="border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-black text-amber-900">
                Payment unsuccessful
              </h2>
              <p className="mt-1 text-sm text-amber-700">
                Your card was not charged. Review the job and restart the escrow
                payment when ready.
              </p>
            </Card>
          )}

          <Card className={cardPadding}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {isDirectRequest && (
                <StatusBadge className="bg-violet-50 text-violet-700 ring-violet-100">
                  Direct request
                </StatusBadge>
              )}
              <StatusBadge className={statusConfig.className}>
                {statusConfig.label}
              </StatusBadge>
            </div>

            <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {job.description}
            </p>

            {categories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {job.status === "open" && <PendingPaymentCard jobId={id} />}

          {isDirectRequest && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Direct request
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                This request is private between you and{" "}
                {kinglancer?.full_name ?? "the Kinglancer"}. Review terms,
                accept changes, fund escrow, or cancel from here.
              </p>
              <DirectRequestActions
                jobId={id}
                viewerRole={profile.role}
                isOwner={true}
                isInvitedKinglancer={false}
                status={job.direct_request_status as DirectRequestStatus}
                message={job.direct_request_message}
                counterBudget={job.counter_budget}
                counterRateType={getCounterRateType(job.counter_rate_type)}
                counterDeadline={job.counter_deadline}
                invitedKinglancer={kinglancer}
                cardEnabled={cardEnabled}
              />
            </Card>
          )}

          {!isDirectRequest && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Applicants ({applications.length})
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Review applicants and select one Kinglancer when you are ready
                to fund escrow.
              </p>
              <ApplicantsList
                applications={applications}
                locked={paymentPending}
                cardEnabled={cardEnabled}
              />
            </Card>
          )}

          {job.status === "open" && !paymentPending && (
            <div className="flex items-center justify-end gap-3">
              <ButtonLink
                href={`/dashboard/client/jobs/${id}/edit`}
                variant="secondary"
                size="sm"
              >
                Edit job
              </ButtonLink>
              <CancelJobButton
                jobId={id}
                status="open"
                hasApplications={applications.length > 0}
              />
            </div>
          )}

          {job.status === "completed" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Work submitted
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Review the submitted work. Approving releases the escrowed
                payment to the Kinglancer.
              </p>
              <ClientApproveActions jobId={id} showApprove />
            </Card>
          )}

          {job.status === "in_progress" && payment_failed !== "1" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Job in progress
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Waiting for the Kinglancer to mark the work as done. You can
                raise a dispute if something has gone wrong.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ClientApproveActions jobId={id} showApprove={false} />
                <CancelJobButton
                  jobId={id}
                  status="in_progress"
                  paymentMethod={heldPaymentMethod}
                />
              </div>
            </Card>
          )}

          {job.status === "approved" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Job approved
              </h2>
              <p className="text-sm text-slate-500">
                This job is complete and the payment release has been approved.
              </p>
            </Card>
          )}

          {job.status === "approved" && (
            <Card id="leave-review" className={`${cardPadding} scroll-mt-24`}>
              <h2 className="text-lg font-black text-slate-950">
                Rate {kinglancerFirstName}
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Your feedback builds trust across the KingsHire community.
              </p>
              <ReviewPanel
                jobId={id}
                counterpartName={kinglancerFirstName}
                counterpartRole="kinglancer"
                myReview={reviewState?.myReview ?? null}
                counterpartReview={reviewState?.counterpartReview ?? null}
                windowClosed={reviewWindowClosed}
                remaining={reviewRemaining}
              />
            </Card>
          )}

          {job.status === "disputed" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Dispute raised
              </h2>
              <p className="text-sm text-slate-500">
                This job is under dispute. Handle the dispute outside of the
                platform before changing the job state.
              </p>
            </Card>
          )}

          {["approved", "completed", "cancelled", "disputed"].includes(
            job.status,
          ) && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Need this job again?
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Repost it as a new listing — you&apos;ll set a fresh date and
                confirm the price and location before it goes live.
              </p>
              <RepostJobButton
                job={{
                  id,
                  title: job.title,
                  description: job.description,
                  categories: job.categories,
                  budget: Number(job.budget),
                  rate_type: job.rate_type as RateType,
                  work_mode: job.work_mode as WorkMode,
                  location: job.location,
                  days_on_site: job.days_on_site,
                  organisation_id: job.organisation_id,
                }}
              />
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Budget
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-600">
              {formatMoney(Number(job.budget))}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatRateType(job.rate_type)}
            </p>
          </Card>

          <Card className="space-y-3 p-5">
            {deadline && (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={16} className="shrink-0 text-slate-400" />
                <span>Deadline: {deadline}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Tag size={16} className="shrink-0 text-slate-400" />
              <span>
                {categories.length > 0
                  ? categories.join(", ")
                  : "No services tagged"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Briefcase size={16} className="shrink-0 text-slate-400" />
              <span>
                Posted{" "}
                {new Date(job.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Kinglancer
            </p>
            {kinglancerName ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={kinglancerName}
                  src={kinglancer?.avatar_url}
                  tone="green"
                />
                <div>
                  <p className="font-bold text-slate-950">{kinglancerName}</p>
                  <p className="text-sm text-slate-500">
                    {job.kinglancer_id ? "Assigned" : "Invited"}
                  </p>
                  {contactRevealed && kinglancer?.phone && (
                    <a
                      href={`tel:${kinglancer.phone}`}
                      className="mt-1 flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline"
                    >
                      <Phone size={13} /> {kinglancer.phone}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                <UserRound size={18} />
                No Kinglancer selected yet
              </div>
            )}
          </Card>

          {job.status === "open" && !isDirectRequest && (
            <ButtonLink href={jobsListHref} variant="secondary">
              <CreditCard size={16} />
              Review all jobs
            </ButtonLink>
          )}
        </aside>
      </div>
    </div>
  );
}
