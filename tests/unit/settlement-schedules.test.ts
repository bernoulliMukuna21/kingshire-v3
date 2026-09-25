import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    period_index: number;
    due_date: string;
    status: string;
  }>,
  engagement: {
    id: "e1",
    source_kind: "org_role",
    organisation_id: "o1",
    kinglancer_id: "w1",
    status: "active",
    amount_per_period: 100,
    cadence: "monthly",
    settlement_mode: "managed",
    duration_periods: null as number | null,
    kinglancer_signed_at: "2026-01-31T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: async () => state.engagement,
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayments: async () => [...state.rows],
  createEngagementPayments: async (inputs: typeof state.rows) => {
    const inserted = inputs
      .filter(
        (input) =>
          !state.rows.some((row) => row.period_index === input.period_index),
      )
      .map((input) => ({ ...input, id: `p${input.period_index}` }));
    state.rows.push(...inserted);
    return inserted;
  },
}));
import { ensureEngagementSchedule } from "@/lib/settlement/schedules";

describe("retryable settlement schedules", () => {
  beforeEach(() => {
    state.rows = [];
    state.engagement.duration_periods = null;
    state.engagement.status = "active";
  });
  it("repeated and concurrent acceptance creates only period one", async () => {
    await Promise.all([
      ensureEngagementSchedule("e1"),
      ensureEngagementSchedule("e1"),
    ]);
    await ensureEngagementSchedule("e1");
    expect(state.rows.map((row) => row.period_index)).toEqual([1]);
  });
  it("repeated fulfilment converges on the explicit next period, preserving settled rows", async () => {
    await ensureEngagementSchedule("e1");
    state.rows[0].status = "held";
    await ensureEngagementSchedule("e1", 2);
    await ensureEngagementSchedule("e1", 2);
    expect(state.rows).toHaveLength(2);
    expect(state.rows[0].status).toBe("held");
    expect(state.rows[1].due_date).toBe("2026-02-28");
    await ensureEngagementSchedule("e1", 3);
    expect(state.rows[2].due_date).toBe("2026-03-31");
  });
  it("fills missing periods without exceeding a bounded duration", async () => {
    state.engagement.duration_periods = 2;
    await ensureEngagementSchedule("e1", 10);
    expect(state.rows.map((row) => row.period_index)).toEqual([1, 2]);
  });
  it("does not extend ended engagements", async () => {
    state.engagement.status = "ended";
    await ensureEngagementSchedule("e1", 3);
    expect(state.rows).toEqual([]);
  });
});
