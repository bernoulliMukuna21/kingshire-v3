import { notFound } from "next/navigation";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { authoriseAgreement } from "@/lib/placement-access";
import {
  getPlacementTitle,
  listCheckIns,
  listMilestones,
} from "@/lib/db/placements";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import MilestoneAddForm from "./MilestoneAddForm";
import MilestoneConfirmButton from "./MilestoneConfirmButton";
import CheckInForm from "./CheckInForm";
import CompleteAgreementForm from "./CompleteAgreementForm";

const STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "Pending acceptance",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function AgreementPage({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) notFound();
  const { agreement, isOrgManager } = access;
  const isActive = agreement.status === "active";

  const [organisationName, placementTitle, milestones, checkIns] =
    await Promise.all([
      getOrganisationName(agreement.organisation_id),
      getPlacementTitle(agreement.placement_id),
      listMilestones(agreementId),
      listCheckIns(agreementId),
    ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={organisationName ?? "Placement"}
        title={placementTitle ?? "Placement agreement"}
        description={`${STATUS_LABEL[agreement.status] ?? agreement.status} · ${agreement.weekly_hours}h/week · ${agreement.duration_weeks} weeks`}
      />

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

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">Milestones</h2>
        <Card className="space-y-4 p-5">
          {isOrgManager && isActive && (
            <MilestoneAddForm agreementId={agreementId} />
          )}
          {!milestones.length ? (
            <p className="text-sm text-slate-500">No milestones yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{m.title}</p>
                    {m.description && (
                      <p className="text-sm text-slate-600">{m.description}</p>
                    )}
                    {m.due_date && (
                      <p className="text-xs text-slate-400">
                        Due{" "}
                        {new Date(m.due_date).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </div>
                  {m.status === "confirmed" ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Confirmed
                    </span>
                  ) : isOrgManager && isActive ? (
                    <MilestoneConfirmButton
                      agreementId={agreementId}
                      milestoneId={m.id}
                    />
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">Check-ins</h2>
        <Card className="space-y-4 p-5">
          {isActive && <CheckInForm agreementId={agreementId} />}
          {!checkIns.length ? (
            <p className="text-sm text-slate-500">No check-ins yet.</p>
          ) : (
            <div className="space-y-3">
              {checkIns.map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {c.note}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {isOrgManager && isActive && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Complete placement
          </h2>
          <Card className="p-5">
            <p className="mb-4 text-sm text-slate-600">
              Completing frees the participant seat and publishes a verified
              experience record on the participant&apos;s profile.
            </p>
            <CompleteAgreementForm
              agreementId={agreementId}
              defaultTitle={placementTitle ?? ""}
            />
          </Card>
        </section>
      )}

      {agreement.status === "completed" && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-emerald-700">
            This placement is complete.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            A verified experience record has been added to the participant&apos;s
            profile.
          </p>
        </Card>
      )}
    </div>
  );
}
