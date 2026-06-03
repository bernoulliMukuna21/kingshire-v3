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
  return base.map((item) => ({
    ...item,
    active:
      item.href === "/jobs"
        ? pathname === "/jobs" || pathname.startsWith("/jobs/")
        : pathname === item.href,
  }));
}
