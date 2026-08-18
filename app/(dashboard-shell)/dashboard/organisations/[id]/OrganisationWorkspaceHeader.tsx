import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

export default function OrganisationWorkspaceHeader({
  organisationId,
  organisationName,
  role,
  subtitle,
  active,
  canManageMembers,
}: {
  organisationId: string;
  organisationName: string;
  role: string;
  subtitle?: string;
  active: string;
  canManageMembers: boolean;
}) {
  const base = `/dashboard/organisations/${organisationId}`;
  const tabs = [
    { key: "overview", label: "Overview", href: `${base}?tab=overview` },
    { key: "team", label: "Team", href: `${base}?tab=team` },
    {
      key: "transactions",
      label: "Transactions",
      href: `${base}/transactions`,
    },
    ...(canManageMembers
      ? [
          {
            key: "placements",
            label: "Placements",
            href: `${base}/placements`,
          },
          { key: "settings", label: "Settings", href: `${base}?tab=settings` },
        ]
      : []),
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${role} workspace`}
        title={organisationName}
        description={subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${base}/jobs/post`}>Post a job</ButtonLink>
            {canManageMembers && (
              <ButtonLink href={`${base}/placements/new`} variant="secondary">
                Post a placement
              </ButtonLink>
            )}
          </div>
        }
      />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              active === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
