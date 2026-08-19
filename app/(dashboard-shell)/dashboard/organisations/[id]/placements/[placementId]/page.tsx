import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import {
  getOrganisationPlacement,
  listPlacementAgreements,
  listPlacementApplicants,
} from "@/lib/db/placements";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import {
  COMPENSATION_LABELS,
  formatCompensationDetail,
  placementWorkModeSummary,
} from "@/lib/placements";
import ApplicantActions from "./ApplicantActions";

export default async function OrganisationPlacementDetailPage({
  params,
}: {
  params: Promise<{ id: string; placementId: string }>;
}) {
  const { id, placementId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (
    !(await requireOrganisationPermission(id, user.id, "manage_applicants"))
  ) {
    notFound();
  }
  const organisationName = await getOrganisationName(id);
  const placement = await getOrganisationPlacement(placementId, id);
  if (!organisationName || !placement) notFound();

  const [applicants, agreements] = await Promise.all([
    listPlacementApplicants(placementId),
    listPlacementAgreements(placementId),
  ]);
  const pendingApplicants = applicants.filter((a) => a.status === "pending");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={organisationName}
        title={placement.title}
        description={`${placement.weekly_hours}h/week · ${placement.duration_weeks} weeks · ${placementWorkModeSummary(placement)}`}
        action={
          <ButtonLink
            href={`/dashboard/organisations/${id}/placements`}
            variant="secondary"
          >
            Back to placements
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase text-slate-400">
            Participant contributes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {placement.contribution}
          </p>
        </Card>
      </div>

      {placement.compensation_types.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-bold uppercase text-slate-400">
            Compensation
          </p>
          <ul className="mt-3 space-y-2">
            {placement.compensation_types.map((type) => (
              <li
                key={type}
                className="flex flex-wrap items-baseline gap-2 text-sm"
              >
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {COMPENSATION_LABELS[type] ?? type}
                </span>
                <span className="text-slate-600">
                  {formatCompensationDetail(
                    type,
                    placement.compensation_details?.[type],
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">Applicants</h2>
        {!pendingApplicants.length ? (
          <EmptyState
            title="No pending applicants"
            description="Applications from Kinglancers will appear here."
          />
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {pendingApplicants.map((a) => (
              <div key={a.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      {a.kinglancer?.full_name ?? "Kinglancer"}
                    </p>
                    {a.kinglancer?.location && (
                      <p className="text-xs text-slate-500">
                        {a.kinglancer.location}
                      </p>
                    )}
                  </div>
                  <ApplicantActions
                    organisationId={id}
                    placementId={placementId}
                    applicationId={a.id}
                  />
                </div>
                {a.message && (
                  <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {a.message}
                  </p>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      {agreements.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Participants
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {agreements.map((ag) => (
              <Link
                key={ag.id}
                href={`/dashboard/placements/agreements/${ag.id}`}
                className="flex items-center justify-between p-4 text-sm hover:bg-slate-50"
              >
                <span className="capitalize text-slate-700">
                  {ag.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-slate-500">
                  {ag.weekly_hours}h/week · {ag.duration_weeks} weeks
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
