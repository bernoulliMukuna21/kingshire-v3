import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable query results the mocked service client returns, controlled per test.
const state = vi.hoisted(() => ({
  agreements: [] as { id: string; status: string }[],
  paidCount: 0,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === "placement_agreements"
        ? {
            select: () => ({
              eq: async () => ({ data: state.agreements }),
            }),
          }
        : {
            select: () => ({
              in: () => ({
                in: async () => ({ count: state.paidCount }),
              }),
            }),
          },
  }),
}));

import { placementDeletionBlocker } from "@/lib/db/placements";

describe("placementDeletionBlocker", () => {
  beforeEach(() => {
    state.agreements = [];
    state.paidCount = 0;
  });

  it("allows deletion when the placement has no participants", async () => {
    await expect(placementDeletionBlocker("p1")).resolves.toBeNull();
  });

  it("blocks deletion while a participant is active", async () => {
    state.agreements = [
      { id: "a1", status: "cancelled" },
      { id: "a2", status: "active" },
    ];
    await expect(placementDeletionBlocker("p1")).resolves.toBe(
      "an active participant",
    );
  });

  it("blocks deletion when money has actually moved", async () => {
    state.agreements = [{ id: "a1", status: "completed" }];
    state.paidCount = 1;
    await expect(placementDeletionBlocker("p1")).resolves.toBe(
      "recorded payments",
    );
  });

  it("allows deletion for cancelled/completed participants with no paid money", async () => {
    state.agreements = [
      { id: "a1", status: "cancelled" },
      { id: "a2", status: "completed" },
    ];
    state.paidCount = 0;
    await expect(placementDeletionBlocker("p1")).resolves.toBeNull();
  });
});
