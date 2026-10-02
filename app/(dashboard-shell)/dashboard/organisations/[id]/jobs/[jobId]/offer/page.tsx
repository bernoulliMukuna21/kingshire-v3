import { deriveRoleOfferView, rolePayLabel } from "@/lib/role-offer-view";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrganisationMembership,
  hasOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { getJobById } from "@/lib/db/jobs";
import { getEngagementBySource, listEngagementCheckIns } from "@/lib/db/engagements";
import { getEngagementPayments } from "@/lib/db/engagement-payments";
import RoleTerminationPanel from "@/components/jobs/RoleTerminationPanel";
import RolePaymentActionButton from "@/components/jobs/RolePaymentActionButton";
import RolePayPeriodButton from "@/components/jobs/RolePayPeriodButton";
import CheckInForm from "@/components/CheckInForm";
import CheckInFeed from "@/components/CheckInFeed";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import OrganisationWorkspaceHeader from "../../../OrganisationWorkspaceHeader";

export default async function OrganisationRoleOfferPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id: organisationId, jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const membership = await getOrganisationMembership(organisationId, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(organisationId);
  const job = await getJobById(jobId, { useServiceRole: true });
  if (!organisationName || !job || job.organisation_id !== organisationId)
    notFound();

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement) notFound();
  const [payments, checkIns] = await Promise.all([
    getEngagementPayments(engagement.id),
    listEngagementCheckIns(engagement.id),
  ]);
  const db = createServiceClient();
  const { data: recipient } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", engagement.kinglancer_id)
    .maybeSingle();
  const view = deriveRoleOfferView(engagement.status);
  const canManage = hasOrganisationPermission(membership.role, "manage_jobs");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 [&_.shadow-xl]:shadow-sm">
      <OrganisationWorkspaceHeader
        organisationId={organisationId}
        organisationName={organisationName}
        role={membership.role}
        active="jobs"
        canManageMembers={
          membership.role === "owner" || membership.role === "admin"
        }
      />
      <main className="space-y-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-slate-500"
        >
          <Link
            href={`/dashboard/organisations/${organisationId}/jobs`}
            className="hover:text-blue-700"
          >
            Jobs
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/dashboard/organisations/${organisationId}/jobs/${jobId}`}
            className="hover:text-blue-700"
          >
            {job.title}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-slate-900">
            {view.title}
          </span>
        </nav>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <StatusBadge className="bg-slate-100 text-slate-700 ring-slate-200">
              {view.label}
            </StatusBadge>
            <h1 className="mt-3 text-2xl font-bold text-slate-950">
              {view.title} {view.title === "Offer" ? "to" : "with"}{" "}
              {recipient?.full_name ?? "the Kinglancer"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{job.title}</p>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-3 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Kinglancer
              </p>
              <p className="mt-2 font-black text-slate-950">
                {recipient?.full_name ?? "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Agreed pay
              </p>
              <p className="mt-2 font-black text-emerald-600">
                {rolePayLabel(engagement.amount_per_period, engagement.cadence)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Arrangement
              </p>
              <p className="mt-2 font-black text-slate-950">
                {engagement.settlement_mode === "managed"
                  ? "KingsHire-managed"
                  : "Direct settlement"}
              </p>
            </div>
          </div>
        </Card>

        {canManage && engagement.status === "pending_funding" && (
          <Card className="border-blue-100 bg-blue-50/60 p-6 sm:p-8">
            <h2 className="text-lg font-black text-slate-950">
              Fund this role to activate it
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {recipient?.full_name ?? "The Kinglancer"} accepted this
              offer. Pay the first period to start the role — this needs an
              explicit payment, it is never charged automatically.
            </p>
            {payments[0] && (
              <div className="mt-4">
                <RolePayPeriodButton
                  jobId={jobId}
                  paymentId={payments[0].id}
                  label="Fund this role"
                />
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-black text-slate-950">Activity</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Offer
              sent
              {engagement.org_signed_at
                ? ` · ${new Date(engagement.org_signed_at).toLocaleDateString("en-GB")}`
                : ""}
            </p>
            {engagement.kinglancer_signed_at && (
              <p>
                Accepted ·{" "}
                {new Date(engagement.kinglancer_signed_at).toLocaleDateString(
                  "en-GB",
                )}
              </p>
            )}
            {engagement.started_at && (
              <p>
                Role started ·{" "}
                {new Date(engagement.started_at).toLocaleDateString("en-GB")}
              </p>
            )}
            {engagement.ended_at && (
              <p>
                Closed ·{" "}
                {new Date(engagement.ended_at).toLocaleDateString("en-GB")}
              </p>
            )}
          </div>
        </Card>

        {payments.length > 0 && (
          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Payments</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Scheduled periods for this agreement.
                </p>
              </div>
              <CreditCard className="text-slate-400" size={20} />
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="font-semibold text-slate-700">
                    Period {payment.period_index} · {payment.due_date}
                  </span>
                  <span className="flex items-center gap-3 font-bold capitalize text-slate-600">
                    {payment.status}
                    {canManage &&
                      payment.status === "processing" &&
                      payment.stripe_payment_intent_id && (
                        <RolePaymentActionButton
                          organisationId={organisationId}
                          paymentId={payment.id}
                        />
                      )}
                    {canManage &&
                      (payment.status === "due" ||
                        payment.status === "failed") &&
                      (engagement.status !== "pending_funding" ||
                        payment.period_index === 1) && (
                        <RolePayPeriodButton
                          jobId={jobId}
                          paymentId={payment.id}
                          label={
                            payment.status === "failed"
                              ? "Retry payment"
                              : "Pay now"
                          }
                        />
                      )}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {engagement.status === "active" && (
          <Card className="p-6 sm:p-8">
            <h2 className="text-lg font-black text-slate-950">Check-ins</h2>
            <p className="mt-1 text-sm text-slate-500">
              Post an update on the work, or ask {recipient?.full_name ?? "the Kinglancer"} a question.
            </p>
            <div className="mt-4 space-y-4">
              {canManage && (
                <CheckInForm endpoint={`/api/jobs/${jobId}/role/check-ins`} />
              )}
              <CheckInFeed
                checkIns={checkIns.map((c) => ({
                  id: c.id,
                  authorId: c.authorId,
                  authorName: c.authorName,
                  note: c.note,
                  createdAt: c.createdAt,
                }))}
                kinglancerId={engagement.kinglancer_id}
              />
            </div>
          </Card>
        )}

        {canManage && view.canManage && (
          <div>
            <RoleTerminationPanel
              jobId={jobId}
              status={engagement.status}
              endRequestedBy={engagement.end_requested_by}
              viewerId={user.id}
              kinglancerId={engagement.kinglancer_id}
            />
          </div>
        )}
      </main>
    </div>
  );
}
