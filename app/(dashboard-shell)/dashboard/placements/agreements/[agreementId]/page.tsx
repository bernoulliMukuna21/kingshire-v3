import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { getOrganisationMembership } from "@/lib/organisations";
import { authoriseAgreement } from "@/lib/placement-access";
import {
  deriveAgreementView,
  placementPaymentPill,
} from "@/lib/placement-agreements";
import {
  getPlacementTitle,
  listCheckIns,
  placementPromisedReference,
} from "@/lib/db/placements";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import CheckInForm from "./CheckInForm";
import CompleteAgreementForm from "./CompleteAgreementForm";
import EndEarlyPanel from "./EndEarlyPanel";
import PayMonthButton from "./PayMonthButton";
import PaymentReviewButtons from "./PaymentReviewButtons";
import ReportIssueButton from "./ReportIssueButton";
import AgreementActions from "@/app/(dashboard-shell)/dashboard/kinglancer/placements/AgreementActions";

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ agreementId: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const { agreementId } = await params;
  const { paid, cancelled } = await searchParams;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) notFound();
  const { agreement, isOrgManager } = access;
  const view = deriveAgreementView(agreement);

  // Early-end request state (either party may propose; the other confirms).
  const hasEndRequest = !!agreement.end_requested_by;
  const proposerIsKinglancer =
    agreement.end_requested_by === agreement.kinglancer_id;
  const iAmEndProposer =
    (access.isKinglancer && proposerIsKinglancer) ||
    (isOrgManager && !proposerIsKinglancer);

  // Ending early also needs the right role: the participant, or an org
  // owner/admin.
  let endEarlyAllowedByRole = access.isKinglancer;
  if (isOrgManager) {
    const membership = await getOrganisationMembership(
      agreement.organisation_id,
      access.userId,
    );
    endEarlyAllowedByRole =
      membership?.role === "owner" || membership?.role === "admin";
  }

  const backHref = isOrgManager
    ? `/dashboard/organisations/${agreement.organisation_id}/placements/${agreement.placement_id}`
    : "/dashboard/kinglancer/placements";

  const [
    organisationName,
    placementTitle,
    checkIns,
    payments,
    referenceRequired,
  ] = await Promise.all([
    getOrganisationName(agreement.organisation_id),
    getPlacementTitle(agreement.placement_id),
    listCheckIns(agreementId),
    view.isManaged
      ? ensurePaymentSchedule(agreement)
      : Promise.resolve([]),
    placementPromisedReference(agreement.placement_id),
  ]);

  const monthOne = payments.find((p) => p.period_index === 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href={backHref}
        className="inline-block text-sm font-bold text-slate-500 hover:text-slate-800"
      >
        ← Back
      </Link>
      <PageHeader
        eyebrow={organisationName ?? "Placement"}
        title={placementTitle ?? "Placement agreement"}
        description={`${view.pill.label} · ${agreement.weekly_hours}h/week · ${agreement.duration_weeks} weeks`}
      />

      {paid && (
        <Card className="border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            Payment received. The Kinglancer will be paid once it clears.
          </p>
        </Card>
      )}
      {cancelled && (
        <Card className="border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Payment cancelled — no charge was made.
          </p>
        </Card>
      )}

      {view.isPending &&
        (access.isKinglancer ? (
          <Card className="border-blue-200 bg-blue-50/60 p-5">
            <h2 className="text-lg font-black text-slate-950">
              You&apos;ve been offered this placement
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">
              Review the contribution and agreed value below, then accept to
              begin. You can decline if it&apos;s not the right fit.
            </p>
            <AgreementActions agreementId={agreementId} />
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50/60 p-5">
            <h2 className="text-lg font-black text-slate-950">
              Waiting for the Kinglancer to accept
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              You&apos;ve offered this placement. It becomes active once the
              Kinglancer accepts the agreement.
            </p>
          </Card>
        ))}

      {view.isPendingFunding &&
        (isOrgManager ? (
          <Card className="border-blue-200 bg-blue-50/60 p-5">
            <h2 className="text-lg font-black text-slate-950">
              Fund the first month to start
            </h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">
              The Kinglancer has accepted. Pay the first month
              {monthOne
                ? ` (£${(Number(monthOne.amount) + Number(monthOne.platform_fee_client)).toFixed(2)})`
                : ""}{" "}
              to activate the placement — it&apos;s held in escrow and released
              to them at month-end. Each following month is charged
              automatically, with a heads-up before the charge.
            </p>
            {monthOne && (
              <PayMonthButton
                agreementId={agreementId}
                paymentId={monthOne.id}
                label="Fund the first month"
              />
            )}
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50/60 p-5">
            <h2 className="text-lg font-black text-slate-950">
              You&apos;ve accepted — waiting on the organisation
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The organisation needs to fund the first month before your
              placement starts. We&apos;ll let you know as soon as it&apos;s
              active.
            </p>
          </Card>
        ))}

      {!isOrgManager && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase text-slate-400">
              Contribution
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {agreement.contribution_terms}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase text-slate-400">
              Agreed value
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {agreement.reward_terms}
            </p>
          </Card>
        </div>
      )}

      {view.isManaged && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-slate-950">Payments</h2>
            <span className="text-sm text-slate-500">
              £{Number(agreement.monthly_amount).toFixed(2)}/month · managed by
              KingsHire
            </span>
          </div>
          {!payments.length ? (
            <Card className="p-5">
              <p className="text-sm text-slate-500">
                The payment schedule will appear once the placement is active.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Month {p.period_index}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isOrgManager
                        ? `You pay £${(Number(p.amount) + Number(p.platform_fee_client)).toFixed(2)}`
                        : `You receive £${(Number(p.amount) - Number(p.platform_fee_kinglancer)).toFixed(2)}`}
                    </p>
                  </div>
                  {isOrgManager && p.status === "failed" ? (
                    <PayMonthButton
                      agreementId={agreementId}
                      paymentId={p.id}
                    />
                  ) : isOrgManager && p.status === "held" ? (
                    <PaymentReviewButtons
                      agreementId={agreementId}
                      paymentId={p.id}
                    />
                  ) : (
                    (() => {
                      const pill = placementPaymentPill(p.status);
                      return (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pill.className}`}
                        >
                          {pill.label}
                        </span>
                      );
                    })()
                  )}
                </div>
              ))}
            </Card>
          )}
          <p className="mt-2 text-xs text-slate-400">
            {isOrgManager
              ? "Each month is charged upfront and held in escrow. We release it to the Kinglancer at month-end (after a 7-day notice) unless you dispute it."
              : "You’re paid at the end of each month, once the organisation’s escrow releases."}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">Check-ins</h2>
        <Card className="space-y-4 p-5">
          {view.canCheckIn && <CheckInForm agreementId={agreementId} />}
          {!checkIns.length ? (
            <p className="text-sm text-slate-500">No check-ins yet.</p>
          ) : (
            <div className="space-y-3">
              {checkIns.map((c) => {
                const fromKinglancer = c.author_id === agreement.kinglancer_id;
                return (
                  <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        {c.author?.full_name ?? "Someone"}
                        <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {fromKinglancer ? "Kinglancer" : "Organisation"}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {c.note}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {isOrgManager && view.canComplete && (
        <div className="flex justify-end">
          <CompleteAgreementForm
            agreementId={agreementId}
            defaultTitle={placementTitle ?? ""}
            referenceRequired={referenceRequired}
          />
        </div>
      )}

      {view.canEndEarly && endEarlyAllowedByRole && (
        <EndEarlyPanel
          agreementId={agreementId}
          hasRequest={hasEndRequest}
          iAmProposer={iAmEndProposer}
          endReason={agreement.end_reason}
          proposerLabel={
            proposerIsKinglancer ? "The Kinglancer" : "The organisation"
          }
        />
      )}

      {agreement.status === "completed" && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-emerald-700">
            This placement is complete.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            A verified experience record has been added to the
            participant&apos;s profile.
          </p>
        </Card>
      )}

      {access.isKinglancer && agreement.status !== "cancelled" && (
        <div className="flex justify-center pt-2">
          <ReportIssueButton agreementId={agreementId} />
        </div>
      )}
    </div>
  );
}
