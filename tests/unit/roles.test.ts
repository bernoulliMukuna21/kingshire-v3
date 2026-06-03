import { describe, expect, it } from "vitest";
import { getRoleHome, isMarketplaceRole } from "@/lib/roles";

describe("isMarketplaceRole", () => {
  it("accepts client and kinglancer roles", () => {
    expect(isMarketplaceRole("client")).toBe(true);
    expect(isMarketplaceRole("kinglancer")).toBe(true);
  });

  it("rejects admin, null, and unknown roles", () => {
    expect(isMarketplaceRole("admin")).toBe(false);
    expect(isMarketplaceRole(null)).toBe(false);
    expect(isMarketplaceRole("other")).toBe(false);
  });
});

describe("getRoleHome", () => {
  it("routes known roles to the correct landing pages", () => {
    expect(getRoleHome("client")).toBe("/dashboard/client");
    expect(getRoleHome("kinglancer")).toBe("/dashboard/kinglancer");
    expect(getRoleHome("admin")).toBe("/admin");
  });

  it("routes missing or unknown roles to onboarding", () => {
    expect(getRoleHome(null)).toBe("/onboarding");
    expect(getRoleHome(undefined)).toBe("/onboarding");
    expect(getRoleHome("other")).toBe("/onboarding");
  });
});
