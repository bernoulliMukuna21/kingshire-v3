export type MarketplaceRole = "client" | "kinglancer";
export type UserRole = MarketplaceRole | "admin" | null;

export function isMarketplaceRole(role: unknown): role is MarketplaceRole {
  return role === "client" || role === "kinglancer";
}

export function isAdminRole(role: unknown): role is "admin" {
  return role === "admin";
}

export function getRoleHome(role: UserRole | string | null | undefined) {
  if (role === "admin") return "/admin";
  if (role === "kinglancer") return "/dashboard/kinglancer";
  if (role === "client") return "/dashboard/client";
  return "/onboarding";
}
