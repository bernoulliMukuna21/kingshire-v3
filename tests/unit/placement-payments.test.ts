import { describe, it, expect, vi, beforeEach } from "vitest";

// Controls what the mocked service-client query returns.
const state = vi.hoisted(() => ({
  rows: [] as { id: string; agreement: { status: string } | null }[],
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          lte: async () => ({ data: state.rows, error: null }),
        }),
      }),
    }),
  }),
}));

import { listDuePlacementPayments } from "@/lib/db/placement-payments";

describe("listDuePlacementPayments", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("returns nothing when there are no due payments", async () => {
    await expect(listDuePlacementPayments()).resolves.toEqual([]);
  });

  it("only returns payments whose agreement is still active", async () => {
    state.rows = [
      { id: "p-active", agreement: { status: "active" } },
      { id: "p-cancelled", agreement: { status: "cancelled" } },
      { id: "p-completed", agreement: { status: "completed" } },
    ];
    const result = await listDuePlacementPayments();
    expect(result.map((r) => r.id)).toEqual(["p-active"]);
  });
});
