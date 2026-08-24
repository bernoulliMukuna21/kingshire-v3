import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, MapPin, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import {
  getOrganisationPlacement,
  listPlacementAgreements,
  listPlacementApplicants,
} from "@/lib/db/placements";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import {
  COMPENSATION_LABELS,
  formatCompensationDetail,
  placementWorkModeSummary,
} from "@/lib/placements";
import ApplicantActions from "./ApplicantActions";
import PlacementActions from "../PlacementActions";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600 ring-slate-200" },
  pending_review: {
    label: "In review",
    color: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  open: {
    label: "Open",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  closed: {
    label: "Closed",
    color: "bg-slate-100 text-slate-500 ring-slate-200",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-50 text-red-700 ring-red-100",
  },
};

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
  cancelled: "Cancelled",
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

  const [applicants, agreements] = await Promise.all([
    listPlacementApplicants(placementId),
    listPlacementAgreements(placementId),
  ]);
  const pendingApplicants = applicants.filter((a) => a.status === "pending");

  let postedByName: string | null = null;
  if (placement.created_by) {
    const { data } = await createServiceClient()
      .from("profiles")
      .select("full_name")
      .eq("id", placement.created_by)
      .maybeSingle();
    postedByName = data?.full_name ?? null;
  }

  const statusConfig = STATUS_CONFIG[placement.status] ?? STATUS_CONFIG.draft;
  const dateRange = [
    formatDate(placement.start_date),
    formatDate(placement.end_date),
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/organisations/${id}/placements`}
          className="inline-block text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          ← Back to placements
        </Link>
        {placement.status === "closed" ||
        placement.status === "cancelled" ? (
          <Link
            href={`/dashboard/organisations/${id}/placements/new?from=${placement.id}`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Repost placement
          </Link>
        ) : (
          <PlacementActions
            organisationId={id}
            placementId={placement.id}
            status={placement.status}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge className={statusConfig.color}>
                {statusConfig.label}
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
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-black text-slate-950">
              Participant contributes
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {placement.contribution}
            </p>
          </Card>

          <section>
            <h2 className="mb-3 text-lg font-black text-slate-950">
              Applicants
              {pendingApplicants.length > 0 && ` (${pendingApplicants.length})`}
            </h2>
            {!pendingApplicants.length ? (
              <EmptyState
                title="No pending applicants"
                description="Applications from Kinglancers will appear here."
              />
            ) : (
              <div className="space-y-3">
                {pendingApplicants.map((a) => (
                  <Card key={a.id} className="space-y-2 p-4">
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
                  </Card>
                ))}
              </div>
            )}
          </section>

          {agreements.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-slate-950">
                Participants
              </h2>
              <p className="mb-3 mt-0.5 text-sm text-slate-500">
                Kinglancers you&apos;ve accepted onto this placement.
              </p>
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {agreements.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between gap-3 p-4 text-sm"
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
                      View agreement →
                    </Link>
                  </div>
                ))}
              </Card>
            </section>
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
            <Card className="space-y-3 border-blue-200 bg-blue-50/40 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Compensation
              </p>
              <ul className="space-y-2">
                {placement.compensation_types.map((type) => (
                  <li
                    key={type}
                    className="flex flex-wrap items-baseline gap-2 text-sm"
                  >
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      {COMPENSATION_LABELS[type] ?? type}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCompensationDetail(
                        type,
                        placement.compensation_details?.[type],
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {placement.compensation_types.includes("money") && (
                <p className="text-xs font-semibold text-blue-700">
                  {placement.payment_mode === "managed"
                    ? "Paid monthly via KingsHire."
                    : "Paid directly by the organisation."}
                </p>
              )}
            </Card>
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
