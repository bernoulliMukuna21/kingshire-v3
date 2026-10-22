export const adminNavigation = [
  { label: "Overview", href: "/admin", icon: "overview" },
  { label: "Action centre", href: "/admin/action-centre", icon: "actions" },
  { label: "Finance", href: "/admin/finance", icon: "finance" },
  { label: "People", href: "/admin/users", icon: "people" },
  { label: "Work", href: "/admin/jobs", icon: "work" },
  { label: "Reviews", href: "/admin/reviews", icon: "reviews" },
  { label: "Enquiries", href: "/admin/support", icon: "support" },
] as const;
export function adminSection(pathname: string) {
  if (
    ["/admin/manual-payments", "/admin/settlements"].some((path) =>
      pathname.startsWith(path),
    )
  )
    return "/admin/finance";
  if (
    ["/admin/placements", "/admin/verifications"].some((path) =>
      pathname.startsWith(path),
    )
  )
    return "/admin/reviews";
  if (
    [
      "/admin/disputes",
      "/admin/role-disputes",
      "/admin/placement-disputes",
    ].some((path) => pathname.startsWith(path))
  )
    return "/admin/action-centre";
  return (
    adminNavigation.find(
      (item) => item.href !== "/admin" && pathname.startsWith(item.href),
    )?.href ?? "/admin"
  );
}
