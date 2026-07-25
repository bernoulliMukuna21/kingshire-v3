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
    label: "My Jobs",
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
  { label: "Post a Job", mobileLabel: "Post", icon: "➕", href: "/jobs/post" },
  {
    label: "My Profile",
    mobileLabel: "Profile",
    icon: "👤",
    href: "/dashboard/profile",
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
    label: "My Profile",
    mobileLabel: "Profile",
    icon: "👤",
    href: "/dashboard/profile",
  },
  { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
  { label: "Organisations", icon: "🏢", href: "/dashboard/organisations" },
];

const ADMIN_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Admin", icon: "🛡️", href: "/admin" },
];

export function getNavItems(
  role: "client" | "kinglancer" | string | null,
  pathname: string,
): DashboardNavItem[] {
  const base =
    role === "admin"
      ? ADMIN_NAV
      : role === "kinglancer"
        ? KINGLANCER_NAV
        : CLIENT_NAV;

  const activeHref = base.reduce((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return item.href.length > best.length ? item.href : best;
  }, "");

  return base.map((item) => ({
    ...item,
    active: item.href === activeHref,
  }));
}
