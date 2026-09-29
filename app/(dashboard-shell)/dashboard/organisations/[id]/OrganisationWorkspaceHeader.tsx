import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import {
  hasOrganisationPermission,
  type OrganisationMemberRole,
} from "@/lib/organisations";

export default function OrganisationWorkspaceHeader({
  organisationId,
  organisationName,
  role,
  active,
  canManageMembers,
  showCreateAction = false,
}: {
  organisationId: string;
  organisationName: string;
  role: OrganisationMemberRole;
  active: string;
  canManageMembers: boolean;
  showCreateAction?: boolean;
}) {
  const base = `/dashboard/organisations/${organisationId}`;
  // Placements are applicant management, which every member can do.
  const canManageApplicants = hasOrganisationPermission(
    role,
    "manage_applicants",
  );
  const tabs = [
    { key: "overview", label: "Overview", href: `${base}?tab=overview` },
    { key: "jobs", label: "Jobs", href: `${base}/jobs` },
    ...(canManageApplicants
      ? [
          {
            key: "placements",
            label: "Placements",
            href: `${base}/placements`,
          },
        ]
      : []),
    { key: "team", label: "Team", href: `${base}?tab=team` },
    {
      key: "transactions",
      label: "Transactions",
      href: `${base}/transactions`,
    },
    ...(canManageMembers
      ? [{ key: "settings", label: "Settings", href: `${base}?tab=settings` }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={base} className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-950 text-lg font-bold text-white">{organisationName.slice(0, 1).toUpperCase()}</span>
          <span className="text-xl font-bold text-slate-950">{organisationName}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{role}</span>
        </Link>
        {showCreateAction && (
          <ButtonLink href={active === "placements" ? `${base}/placements/new` : `${base}/jobs/post`}>
            {active === "placements" ? "Post a placement" : "Post a job"}
          </ButtonLink>
        )}
      </div>
      <nav aria-label="Organisation" className="flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              active === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
