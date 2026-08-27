import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  Briefcase,
  Tag,
  AlertCircle,
  MapPin,
  Clock,
  Monitor,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BackButton from "./BackButton";
import { getJobById } from "@/lib/db/jobs";
import { jobStatusPill } from "@/lib/jobs";
import type { RateType, DirectRequestStatus } from "@/lib/jobs";
import { getApplicationsByJob, hasApplied } from "@/lib/db/applications";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import { formatDeadline } from "@/lib/utils";
import {
  ApplyForm,
  ApplicantsList,
  KinglancerCompleteButton,
  ClientApproveActions,
  DirectRequestActions,
} from "./JobActions";
import PublicShell from "@/components/ui/PublicShell";
import { ButtonLink } from "@/components/ui/Button";
import { Card, cardPadding } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_failed?: string }>;
}) {
  const { id } = await params;
  const { payment_failed } = await searchParams;
  const supabase = await createClient();

  // Phase 1: job fetch and auth check run in parallel
  const [
    job,
    {
      data: { user },
    },
  ] = await Promise.all([getJobById(id), supabase.auth.getUser()]);
  if (!job) notFound();

  const isOwner = user?.id === job.client_id;
  const isAssignedKinglancer = user?.id === job.kinglancer_id;
  const isDirectRequest = !!job.invited_kinglancer_id;
  const isInvitedKinglancer = user?.id === job.invited_kinglancer_id;

  let profile: {
    id: string;
    role: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null = null;
  let alreadyApplied = false;
  let applications: ApplicationWithKinglancer[] = [];
  let invitedKinglancer: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null = null;

  if (user) {
    // Phase 2: profile, applications list (if owner), hasApplied, and invited kinglancer all in parallel
    const [profileResult, applicationsResult, appliedResult, invitedKlResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, role, full_name, avatar_url")
          .eq("id", user.id)
          .single(),
        isOwner && !isDirectRequest
          ? getApplicationsByJob(id)
          : Promise.resolve([] as ApplicationWithKinglancer[]),
        hasApplied(id, user.id),
        isDirectRequest && job.invited_kinglancer_id
          ? supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", job.invited_kinglancer_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);
    profile = profileResult.data;
    applications = applicationsResult;
    alreadyApplied = appliedResult;
    invitedKinglancer = invitedKlResult.data as typeof invitedKinglancer;
  }

  if (isDirectRequest && !user) {
    notFound();
  }

  if (profile?.role === "client" && isOwner) {
    const failedParam = payment_failed === "1" ? "?payment_failed=1" : "";
    redirect(`/dashboard/client/jobs/${id}${failedParam}`);
  }

  if (
    profile?.role === "kinglancer" &&
    (isAssignedKinglancer || isInvitedKinglancer)
  ) {
    redirect(`/dashboard/kinglancer/jobs/${id}`);
  }

  if (
    isDirectRequest &&
    !isOwner &&
    !isInvitedKinglancer &&
    profile?.role !== "admin"
  ) {
    notFound();
  }

  const canApply =
    profile &&
    profile.role === "kinglancer" &&
    !isOwner &&
    !isDirectRequest &&
    job.status === "open" &&
    !alreadyApplied;
  const isAdmin = profile?.role === "admin";

  const s = jobStatusPill(job.status);
  const rateType = job.rate_type ?? "fixed";
  const budgetSuffix =
    rateType === "per_hour"
      ? "/hr"
      : rateType === "per_day"
        ? "/day"
        : " (fixed)";
  const budgetNote =
    rateType === "fixed"
      ? "Fixed price held in escrow on selection"
      : rateType === "per_hour"
        ? "Hourly rate held in escrow on selection"
        : "Daily rate held in escrow on selection";

  const pageContent = (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <BackButton />

      {isOwner && payment_failed === "1" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              Payment unsuccessful
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              Your card was not charged. Please try again — select a Kinglancer
              below to restart the payment.
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className={cardPadding}>
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge className={s.className}>{s.label}</StatusBadge>
            </div>

            <h1 className="text-xl font-black text-slate-950 mb-4">
              {job.title}
            </h1>

            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>

            {(job.categories ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5">
                {job.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {isOwner && !isDirectRequest && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="font-bold text-gray-900 mb-4">
                Applicants ({applications.length})
              </h2>
              <ApplicantsList applications={applications} />
            </Card>
          )}

          {/* Payment failed: job is still in_progress pending cron cleanup,
              but show the applicants panel so the client can re-select */}
          {isOwner &&
            !isDirectRequest &&
            job.status === "in_progress" &&
            payment_failed === "1" && (
              <Card className={cardPadding}>
                <h2 className="font-bold text-gray-900 mb-4">
                  Applicants ({applications.length})
                </h2>
                <ApplicantsList applications={applications} />
              </Card>
            )}

          {isAssignedKinglancer && job.status === "in_progress" && (
            <Card className={cardPadding}>
              <h2 className="font-bold text-gray-900 mb-1">Ready to submit?</h2>
              <p className="text-sm text-gray-500 mb-4">
                Once you mark your work as done, the client will be asked to
                review and approve it.
              </p>
              <KinglancerCompleteButton jobId={id} />
            </Card>
          )}

          {isOwner && job.status === "completed" && (
            <Card className={cardPadding}>
              <h2 className="font-bold text-gray-900 mb-1">Work submitted</h2>
              <p className="text-sm text-gray-500 mb-4">
                The Kinglancer has marked this work as done. Review it and
                release the payment, or raise a dispute if something is wrong.
              </p>
              <ClientApproveActions jobId={id} showApprove={true} />
            </Card>
          )}

          {isOwner &&
            job.status === "in_progress" &&
            payment_failed !== "1" && (
              <Card className={cardPadding}>
                <h2 className="font-bold text-gray-900 mb-1">
                  Job in progress
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Waiting for the Kinglancer to complete the work and submit it
                  for review.
                </p>
                <ClientApproveActions jobId={id} showApprove={false} />
              </Card>
            )}

          {isDirectRequest && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="font-bold text-gray-900 mb-1">Direct request</h2>
              <p className="mb-4 text-sm text-gray-500">
                This job was sent directly to a specific Kinglancer. Escrow is
                only funded once both sides agree on the terms.
              </p>
              <DirectRequestActions
                jobId={id}
                viewerRole={profile?.role}
                isOwner={isOwner}
                isInvitedKinglancer={!!isInvitedKinglancer}
                status={job.direct_request_status as DirectRequestStatus}
                message={job.direct_request_message}
                counterBudget={job.counter_budget}
                counterRateType={job.counter_rate_type as RateType | null}
                counterDeadline={job.counter_deadline}
                invitedKinglancer={invitedKinglancer}
              />
            </Card>
          )}

          {!isDirectRequest && !isOwner && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="font-bold text-gray-900 mb-1">
                {isAdmin ? "Admin view" : "Apply"}
              </h2>
              {isAdmin ? (
                <p className="text-sm text-gray-500 mt-3">
                  Admin accounts can inspect jobs, but cannot apply, hire, or
                  take payment actions. Use a client or kinglancer account to
                  test marketplace flows.
                </p>
              ) : !user ? (
                <div className="text-sm text-gray-500 space-y-3 mt-3">
                  <p>Sign in to apply for this job.</p>
                  <ButtonLink href="/sign-in" size="sm">
                    Sign in
                  </ButtonLink>
                </div>
              ) : alreadyApplied ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mt-3">
                  <span className="text-green-600 text-sm font-medium">
                    ✓ You have already applied to this job.
                  </span>
                </div>
              ) : canApply ? (
                <div className="mt-3">
                  <ApplyForm jobId={id} />
                </div>
              ) : profile?.role === "client" ? (
                <p className="text-sm text-gray-500 mt-3">
                  Switch your account to Kinglancer to apply for jobs.
                </p>
              ) : null}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Budget
            </p>
            <p className="text-3xl font-black text-green-600">
              £{Number(job.budget).toLocaleString()}
              <span className="text-base font-medium text-gray-500 ml-1">
                {budgetSuffix}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">{budgetNote}</p>
            {canApply && (
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-3">
                By applying you agree to complete this work for the budget
                stated above.
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-3">
                {job.work_mode === "online" ? (
                  <Monitor size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <MapPin size={16} className="text-gray-400 shrink-0" />
                )}
                <strong>
                  {job.work_mode === "in_person"
                    ? "In person"
                    : job.work_mode === "hybrid"
                      ? "Hybrid"
                      : "Online / remote"}
                </strong>
              </div>
              {job.work_mode !== "online" && job.location && (
                <p className="mt-1 pl-7 text-gray-500">
                  {job.location}
                  {job.work_mode === "hybrid" && job.days_on_site
                    ? ` · ${job.days_on_site} day${
                        job.days_on_site > 1 ? "s" : ""
                      } on-site/week`
                    : ""}
                </p>
              )}
            </div>
            {job.scheduled_at && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock size={16} className="text-gray-400 shrink-0" />
                <span>
                  {job.work_mode === "in_person"
                    ? new Date(job.scheduled_at).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date(job.scheduled_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                  {job.ends_at
                    ? ` → ${
                        job.work_mode === "in_person"
                          ? new Date(job.ends_at).toLocaleString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(job.ends_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                      }`
                    : ""}
                </span>
              </div>
            )}
            {!job.scheduled_at && job.deadline && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span>
                  Deadline: <strong>{formatDeadline(job.deadline)}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Tag size={16} className="text-gray-400 shrink-0" />
              <span>{(job.categories ?? []).join(", ")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Briefcase size={16} className="text-gray-400 shrink-0" />
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Posted by
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden shrink-0">
                {job.client.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.client.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  job.client.full_name[0]?.toUpperCase()
                )}
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {job.client.full_name}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <PublicShell navbarVariant="solid">
      <div className="pt-20">{pageContent}</div>
    </PublicShell>
  );
}
