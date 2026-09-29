export type DashboardNavItem = {
  label: string;
  mobileLabel?: string;
  icon: string;
  href: string;
  active: boolean;
};

const CLIENT_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Dashboard", icon: "⬛", href: "/dashboard/client" },
  {
    label: "Action Centre",
    mobileLabel: "Action",
    icon: "⚡",
    href: "/dashboard/action-centre",
  },
  {
    label: "Jobs",
    mobileLabel: "Jobs",
    icon: "💼",
    href: "/dashboard/client/jobs",
  },
  {
    label: "Transactions",
    mobileLabel: "Payouts",
    icon: "💳",
    href: "/dashboard/client/transactions",
  },
  { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
  { label: "Organisations", icon: "🏢", href: "/dashboard/organisations" },
];

const KINGLANCER_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Dashboard", icon: "⬛", href: "/dashboard/kinglancer" },
  {
    label: "Action Centre",
    mobileLabel: "Action",
    icon: "⚡",
    href: "/dashboard/action-centre",
  },
  {
    label: "My Jobs",
    mobileLabel: "Jobs",
    icon: "💼",
    href: "/dashboard/kinglancer/jobs",
  },
  { label: "Browse Jobs", mobileLabel: "Browse", icon: "🔎", href: "/jobs" },
  {
    label: "Placements",
    icon: "🎓",
    href: "/dashboard/kinglancer/placements",
  },
  { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
];

const ADMIN_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Admin", icon: "🛡️", href: "/admin" },
];

export function getNavItems(
  role: "client" | "kinglancer" | string | null,
  pathname: string,
  organisation?: { id: string; role: "owner" | "admin" | "member" },
  tab?: string,
): DashboardNavItem[] {
  const orgBase = organisation ? `/dashboard/organisations/${organisation.id}` : "";
  const base: Omit<DashboardNavItem, "active">[] = organisation ? [
    { label: "Dashboard", icon: "⬛", href: orgBase },
    { label: "Action Centre", icon: "⚡", href: `/dashboard/action-centre?workspace=${organisation.id}` },
    { label: "Jobs", icon: "💼", href: `${orgBase}/jobs` },
    { label: "Placements", icon: "🎓", href: `${orgBase}/placements` },
    { label: "Transactions", icon: "💳", href: `${orgBase}/transactions` },
    { label: "Team", icon: "👥", href: `${orgBase}?tab=team` },
    ...(organisation.role !== "member" ? [{ label: "Settings", icon: "⚙️", href: `${orgBase}?tab=settings` }] : []),
  ] : role === "admin"
      ? ADMIN_NAV
      : role === "kinglancer"
        ? KINGLANCER_NAV
        : CLIENT_NAV;

  const activeHref = base.reduce((best, item) => {
    const [path, query] = item.href.split("?");
    const targetTab = new URLSearchParams(query).get("tab");
    const matches = (pathname === path || pathname.startsWith(`${path}/`))
      && (!targetTab || targetTab === tab);
    if (!matches) return best;
    return item.href.length > best.length ? item.href : best;
  }, "");

  return base.map((item) => ({
    ...item,
    active: item.href === activeHref,
  }));
}
