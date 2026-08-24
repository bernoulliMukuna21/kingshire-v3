import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import {
  activeParticipantCountsByPlacement,
  listOrganisationPlacements,
} from "@/lib/db/placements";
import { placementWorkModeSummary } from "@/lib/placements";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import JobsTabBar from "@/components/dashboard/JobsTabBar";
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

// ── Tab definitions ────────────────────────────────────────

type Tab =
  | "all"
  | "active"
  | "open"
  | "review"
  | "draft"
  | "closed"
  | "cancelled";

// Active is cross-cutting (filtered by active participants, not status).
const TAB_STATUSES: Record<Tab, string[]> = {
  all: [],
  active: [],
  open: ["open"],
  review: ["pending_review"],
  draft: ["draft"],
  closed: ["closed"],
  cancelled: ["cancelled"],
};

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  active: "Active",
  open: "Open",
  review: "In review",
  draft: "Draft",
  closed: "Closed",
  cancelled: "Cancelled",
};

const TAB_ORDER: Tab[] = [
  "all",
  "draft",
  "review",
  "open",
  "active",
  "closed",
  "cancelled",
];

function parseTab(raw: string | undefined): Tab {
  return TAB_ORDER.includes(raw as Tab) ? (raw as Tab) : "all";
}

export default async function OrganisationPlacementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
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

  const allPlacements = await listOrganisationPlacements(id);
  const activeCounts = await activeParticipantCountsByPlacement(id);
  const tab = parseTab(tabParam);

  const matchesTab = (t: Tab, p: (typeof allPlacements)[number]) => {
    if (t === "all") return true;
    if (t === "active") return (activeCounts[p.id] ?? 0) > 0;
    return TAB_STATUSES[t].includes(p.status);
  };

  const tabCounts = TAB_ORDER.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allPlacements.filter((p) => matchesTab(t, p)).length;
    return acc;
  }, {});

  const placements = allPlacements.filter((p) => matchesTab(tab, p));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        active="placements"
        canManageMembers={
          membership.role === "owner" || membership.role === "admin"
        }
      />
      {allPlacements.length > 0 && (
        <JobsTabBar
          tabs={TAB_ORDER}
          labels={TAB_LABELS}
          counts={tabCounts}
          activeTab={tab}
          basePath={`/dashboard/organisations/${id}/placements`}
          accentTab="open"
        />
      )}
      {!allPlacements.length ? (
        <EmptyState
          title="No placements yet"
          description="Create your organisation's first experience placement."
          action={
            <ButtonLink href={`/dashboard/organisations/${id}/placements/new`}>
              Create placement
            </ButtonLink>
          }
        />
      ) : !placements.length ? (
        <EmptyState
          title={`No ${TAB_LABELS[tab].toLowerCase()} placements`}
          description={`No placements in the ${TAB_LABELS[tab].toLowerCase()} category right now.`}
        />
      ) : (
        <div className="space-y-3">
          {placements.map((p) => (
            <Card
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
                  {(activeCounts[p.id] ?? 0) > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      {activeCounts[p.id]} active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p.weekly_hours}h/week · {p.duration_weeks} weeks ·{" "}
                  {placementWorkModeSummary(p)}
                </p>
              </div>
              <PlacementActions
                organisationId={id}
                placementId={p.id}
                status={p.status}
                canDelete={
                  membership.role === "owner" || membership.role === "admin"
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
