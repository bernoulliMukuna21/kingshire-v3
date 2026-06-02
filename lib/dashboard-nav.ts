export type DashboardNavItem = {
  label: string;
  icon: string;
  href: string;
  active: boolean;
};

const CLIENT_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Dashboard", icon: "⬛", href: "/dashboard/client" },
  { label: "My Jobs", icon: "💼", href: "/dashboard/client/jobs" },
  { label: "Transactions", icon: "💳", href: "/dashboard/client/transactions" },
  { label: "Post a Job", icon: "➕", href: "/jobs/post" },
  { label: "My Profile", icon: "👤", href: "/dashboard/profile" },
  { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
];

const KINGLANCER_NAV: Omit<DashboardNavItem, "active">[] = [
  { label: "Dashboard", icon: "⬛", href: "/dashboard/kinglancer" },
  { label: "Browse Jobs", icon: "🔍", href: "/jobs" },
  { label: "My Profile", icon: "👤", href: "/dashboard/profile" },
  { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
];

export function getNavItems(
  role: "client" | "kinglancer" | string | null,
  activeHref: string,
): DashboardNavItem[] {
  const base = role === "kinglancer" ? KINGLANCER_NAV : CLIENT_NAV;
  return base.map((item) => ({ ...item, active: item.href === activeHref }));
}
