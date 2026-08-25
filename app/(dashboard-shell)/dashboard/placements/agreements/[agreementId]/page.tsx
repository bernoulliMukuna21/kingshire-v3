import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { authoriseAgreement } from "@/lib/placement-access";
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
import PayMonthButton from "./PayMonthButton";
import ReportIssueButton from "./ReportIssueButton";
import AgreementActions from "@/app/(dashboard-shell)/dashboard/kinglancer/placements/AgreementActions";

const STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "Pending acceptance",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  due: "Scheduled",
  processing: "Processing",
  held: "In escrow",
  released: "Paid",
  failed: "Payment failed",
  cancelled: "Cancelled",
};

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  due: "bg-slate-100 text-slate-600",
  processing: "bg-amber-100 text-amber-700",
  held: "bg-blue-100 text-blue-700",
  released: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-slate-100 text-slate-500",
};

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
  const isActive = agreement.status === "active";
  const isPendingAcceptance = agreement.status === "pending_acceptance";
  const isManaged =
    agreement.payment_mode === "managed" && !!agreement.monthly_amount;

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
    isManaged ? ensurePaymentSchedule(agreement) : Promise.resolve([]),
    placementPromisedReference(agreement.placement_id),
  ]);

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
        description={`${STATUS_LABEL[agreement.status] ?? agreement.status} · ${agreement.weekly_hours}h/week · ${agreement.duration_weeks} weeks`}
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

      {isPendingAcceptance &&
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

      {isManaged && (
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
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        PAYMENT_STATUS_CLASS[p.status] ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  )}
                </div>
              ))}
            </Card>
          )}
          <p className="mt-2 text-xs text-slate-400">
            {isOrgManager
              ? "Each month is charged automatically to your saved card. If a charge fails, retry it here."
              : "You’ll be paid each month once the organisation’s payment clears."}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">Check-ins</h2>
        <Card className="space-y-4 p-5">
          {isActive && <CheckInForm agreementId={agreementId} />}
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

      {isOrgManager && isActive && (
        <div className="flex justify-end">
          <CompleteAgreementForm
            agreementId={agreementId}
            defaultTitle={placementTitle ?? ""}
            referenceRequired={referenceRequired}
          />
        </div>
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
