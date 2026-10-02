import { describe, expect, it } from "vitest";
import { getNavItems } from "@/lib/dashboard-nav";
import { scopeActionCentre } from "@/lib/action-centre/view";
import type { ActionCentreItem } from "@/lib/action-centre/types";

describe("workspace navigation", () => {
  it("keeps job creation inside Jobs and preserves worker browsing", () => {
    expect(getNavItems("client", "/dashboard/client/jobs").filter(i => i.active).map(i => i.label)).toEqual(["Jobs"]);
    expect(getNavItems("client", "").some(i => i.href === "/jobs/post")).toBe(false);
    expect(getNavItems("kinglancer", "").some(i => i.label === "Browse Jobs")).toBe(true);
  });
  it("selects organisation tabs without marking the overview active", () => {
    const nav = getNavItems("client", "/dashboard/organisations/o", { id: "o", role: "owner" }, "team");
    expect(nav.filter(i => i.active).map(i => i.label)).toEqual(["Team"]);
    expect(getNavItems("client", "", { id: "o", role: "member" }).some(i => i.label === "Settings")).toBe(false);
  });
  it("selects the scoped action centre", () => {
    expect(getNavItems("client", "/dashboard/action-centre", { id: "o", role: "member" }).filter(i => i.active).map(i => i.label)).toEqual(["Action Centre"]);
  });
});

describe("action workspace projection", () => {
  const base: ActionCentreItem = { id: "personal", title: "Job", description: "Review", href: "/job", icon: "review", badge: "Review", tone: "blue", kind: "action" };
  const items = [base, { ...base, id: "org", workspaceId: "o", kind: "waiting" as const }];
  it("derives counts from the selected list", () => {
    expect(scopeActionCentre(items, "personal")).toEqual({ items: [base], actionCount: 1, waitingCount: 0 });
    expect(scopeActionCentre(items, "o")).toEqual({ items: [items[1]], actionCount: 0, waitingCount: 1 });
    expect(scopeActionCentre(items).items).toHaveLength(2);
    expect(scopeActionCentre(items, "unknown").items).toHaveLength(0);
  });
});
