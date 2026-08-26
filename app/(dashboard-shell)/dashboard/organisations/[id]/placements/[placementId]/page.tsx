import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Gift,
  MapPin,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import {
  getOrganisationPlacement,
  listPlacementAgreements,
  listPlacementApplicants,
} from "@/lib/db/placements";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import {
  COMPENSATION_LABELS,
  formatCompensationDetail,
  placementWorkModeSummary,
  derivePlacementView,
} from "@/lib/placements";
import ApplicantActions from "./ApplicantActions";
import PlacementActions from "../PlacementActions";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
}

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  pending_acceptance: "Awaiting the Kinglancer’s acceptance",
  active: "Active",
  completed: "Completed",
  cancelled: "Ended early",
};

const PARTICIPANT_STATUS_CLASS: Record<string, string> = {
  pending_acceptance: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};

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

  const membership = await getOrganisationMembership(id, user.id);
  const canDelete =
    membership?.role === "owner" || membership?.role === "admin";

  const [applicants, agreements] = await Promise.all([
    listPlacementApplicants(placementId),
    listPlacementAgreements(placementId),
  ]);
  const pendingApplicants = applicants.filter((a) => a.status === "pending");
  const activeCount = agreements.filter((a) => a.status === "active").length;

  let postedByName: string | null = null;
  if (placement.created_by) {
    const { data } = await createServiceClient()
      .from("profiles")
      .select("full_name")
      .eq("id", placement.created_by)
      .maybeSingle();
    postedByName = data?.full_name ?? null;
  }

  const view = derivePlacementView(placement.status, {
    activeCount,
    canDelete,
  });
  const dateRange = [
    formatDate(placement.start_date),
    formatDate(placement.end_date),
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/organisations/${id}/placements`}
        className="inline-block text-sm font-bold text-slate-500 hover:text-slate-800"
      >
        ← Back to placements
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card className="p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge className={view.pill.className}>
                {view.pill.label}
              </StatusBadge>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {organisationName}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
              {placement.title}
            </h1>
            {placement.summary && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {placement.summary}
              </p>
            )}
            {placement.categories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {placement.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
            {placement.contribution && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  What the placement involves
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {placement.contribution}
                </p>
              </div>
            )}
          </Card>

          {pendingApplicants.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-black text-slate-950">
                Applicants ({pendingApplicants.length})
              </h2>
              <div className="mt-4 divide-y divide-slate-100">
                {pendingApplicants.map((a) => (
                  <div
                    key={a.id}
                    className="space-y-2 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/kinglancers/${a.kinglancer_id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Avatar
                          name={a.kinglancer?.full_name}
                          src={a.kinglancer?.avatar_url}
                          className="h-9 w-9"
                        />
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
                      </Link>
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
                    {a.cv_url && (
                      <a
                        href={a.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
                      >
                        View CV →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {agreements.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-black text-slate-950">
                Participants
              </h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Kinglancers you&apos;ve accepted onto this placement.
              </p>
              <div className="divide-y divide-slate-100">
                {agreements.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <Link
                      href={`/kinglancers/${ag.kinglancer_id}`}
                      className="flex min-w-0 items-center gap-3 hover:underline"
                    >
                      <Avatar
                        name={ag.kinglancer?.full_name}
                        src={ag.kinglancer?.avatar_url}
                        className="h-9 w-9"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {ag.kinglancer?.full_name ?? "Kinglancer"}
                        </p>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            PARTICIPANT_STATUS_CLASS[ag.status] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {PARTICIPANT_STATUS_LABEL[ag.status] ?? ag.status}
                        </span>
                      </div>
                    </Link>
                    <Link
                      href={`/dashboard/placements/agreements/${ag.id}`}
                      className="shrink-0 text-xs font-bold text-blue-600 hover:underline"
                    >
                      {ag.status === "active" ? "Track progress →" : "View →"}
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {pendingApplicants.length === 0 &&
            agreements.length === 0 &&
            (placement.status === "open" ||
              placement.status === "pending_review") && (
              <Card className="p-6 text-center">
                <p className="text-sm font-bold text-slate-700">
                  No applicants yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Applications from Kinglancers will appear here.
                </p>
              </Card>
            )}

          {view.actions.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <PlacementActions
                organisationId={id}
                placementId={placement.id}
                actions={view.actions}
              />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Placement details
            </p>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Clock size={16} className="shrink-0 text-slate-400" />
              <span>{placement.weekly_hours}h per week</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Calendar size={16} className="shrink-0 text-slate-400" />
              <span>
                {placement.duration_weeks} week
                {placement.duration_weeks === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <MapPin size={16} className="shrink-0 text-slate-400" />
              <span>{placementWorkModeSummary(placement)}</span>
            </div>
            {dateRange && (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar size={16} className="shrink-0 text-slate-400" />
                <span>{dateRange}</span>
              </div>
            )}
          </Card>

          {placement.compensation_types.length > 0 && (
            <div className="rounded-3xl bg-linear-to-br from-blue-600 to-indigo-600 p-5 text-white shadow-xl shadow-blue-500/25">
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-blue-100" />
                <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
                  Compensation
                </p>
              </div>
              <ul className="mt-4 space-y-3">
                {placement.compensation_types.map((type) => (
                  <li key={type}>
                    <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      {COMPENSATION_LABELS[type] ?? type}
                    </span>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
                      {formatCompensationDetail(
                        type,
                        placement.compensation_details?.[type],
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              {placement.compensation_types.includes("money") && (
                <p className="mt-4 border-t border-white/20 pt-3 text-xs font-semibold text-blue-100">
                  {placement.payment_mode === "managed"
                    ? "Paid monthly via KingsHire."
                    : "Paid directly by the organisation."}
                </p>
              )}
            </div>
          )}

          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Posted by
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-700">
              <UserRound size={16} className="shrink-0 text-slate-400" />
              <span className="font-bold">
                {postedByName ?? "Organisation member"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Posted{" "}
              {new Date(placement.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
