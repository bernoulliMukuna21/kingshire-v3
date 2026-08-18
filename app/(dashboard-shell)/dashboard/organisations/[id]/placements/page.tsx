import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { listOrganisationPlacements } from "@/lib/db/placements";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import OrganisationWorkspaceHeader from "../OrganisationWorkspaceHeader";
import PlacementActions from "./PlacementActions";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "In review",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_review: "bg-amber-100 text-amber-700",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};

export default async function OrganisationPlacementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) {
    notFound();
  }
  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();

  const placements = await listOrganisationPlacements(id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        subtitle="Supervised experience placements — participants receive the value you declare, these are not paid jobs."
        active="placements"
        canManageMembers={
          membership.role === "owner" || membership.role === "admin"
        }
      />
      {!placements.length ? (
        <EmptyState
          title="No placements yet"
          description="Create your organisation's first experience placement."
          action={
            <ButtonLink href={`/dashboard/organisations/${id}/placements/new`}>
              Create placement
            </ButtonLink>
          }
        />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {placements.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/organisations/${id}/placements/${p.id}`}
                    className="truncate font-bold text-slate-950 hover:text-blue-700"
                  >
                    {p.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      STATUS_CLASS[p.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.weekly_hours}h/week · {p.duration_weeks} weeks
                  {p.is_remote
                    ? " · Remote"
                    : p.location
                      ? ` · ${p.location}`
                      : ""}
                </p>
              </div>
              <PlacementActions
                organisationId={id}
                placementId={p.id}
                status={p.status}
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
