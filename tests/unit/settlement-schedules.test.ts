import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    period_index: number;
    due_date: string;
    status: string;
    worker_amount: number;
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
  job: {
    employment_type: "permanent" as string | null,
    scheduled_at: null as string | null,
    ends_at: null as string | null,
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
vi.mock("@/lib/db/jobs", () => ({
  getJobById: async () => state.job,
}));
import { ensureEngagementSchedule } from "@/lib/settlement/schedules";
import { roleBillingFractions } from "@/lib/settlement/schedule";
import { roleScheduleMeetsMinimumCharge } from "@/lib/settlement/role-schedule-policy";

describe("retryable settlement schedules", () => {
  beforeEach(() => {
    state.rows = [];
    state.engagement.duration_periods = null;
    state.engagement.status = "active";
    state.job = { employment_type: "permanent", scheduled_at: null, ends_at: null };
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

describe("roleBillingFractions", () => {
  it("bills whole periods plus a prorated tail", () => {
    const fractions = roleBillingFractions(
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-03-15T00:00:00Z"),
      "monthly",
    );
    expect(fractions).toHaveLength(3);
    expect(fractions[0]).toBe(1);
    expect(fractions[1]).toBe(1);
    expect(fractions[2]).toBeGreaterThan(0);
    expect(fractions[2]).toBeLessThan(1);
  });
  it("folds a trailing sliver into the last full period instead of dropping it", () => {
    const fractions = roleBillingFractions(
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-02-02T00:00:00Z"),
      "monthly",
    );
    expect(fractions).toHaveLength(1);
    expect(fractions[0]).toBeGreaterThan(1);
  });
  it("still bills a short role with no full period at all", () => {
    const fractions = roleBillingFractions(
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-03T00:00:00Z"),
      "monthly",
    );
    expect(fractions).toHaveLength(1);
    expect(fractions[0]).toBeGreaterThan(0);
    expect(fractions[0]).toBeLessThan(1);
  });
  it("returns nothing when the bound has already passed the anchor", () => {
    expect(
      roleBillingFractions(
        new Date("2026-03-01T00:00:00Z"),
        new Date("2026-01-01T00:00:00Z"),
        "monthly",
      ),
    ).toEqual([]);
  });
});

describe("roleScheduleMeetsMinimumCharge", () => {
  it("rejects a full-period amount whose prorated tail falls below the rail minimum", () => {
    expect(
      roleScheduleMeetsMinimumCharge({
        anchor: new Date("2026-01-01T00:00:00Z"),
        boundEnd: new Date("2026-03-06T00:00:00Z"),
        cadence: "monthly",
        amountPerPeriod: 10,
        settlementMode: "managed",
      }),
    ).toBe(false);
  });

  it("accepts a bounded schedule when every resulting charge clears the minimum", () => {
    expect(
      roleScheduleMeetsMinimumCharge({
        anchor: new Date("2026-01-01T00:00:00Z"),
        boundEnd: new Date("2026-03-15T00:00:00Z"),
        cadence: "monthly",
        amountPerPeriod: 100,
        settlementMode: "managed",
      }),
    ).toBe(true);
  });
});

describe("bounded temporary-role schedules", () => {
  beforeEach(() => {
    state.rows = [];
    state.engagement.duration_periods = null;
    state.engagement.status = "active";
    state.engagement.cadence = "monthly";
    state.job = {
      employment_type: "temporary",
      scheduled_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-03-15T00:00:00Z",
    };
  });
  it("anchors on the advertised start date and prorates the final period", async () => {
    await ensureEngagementSchedule("e1", 10);
    expect(state.rows.map((row) => row.period_index)).toEqual([1, 2, 3]);
    expect(state.rows[0].due_date).toBe("2026-01-01");
    expect(state.rows[2].worker_amount).toBeLessThan(state.rows[0].worker_amount);
  });
  it("does not create periods beyond the advertised end date", async () => {
    await ensureEngagementSchedule("e1", 10);
    await ensureEngagementSchedule("e1", 10);
    expect(state.rows).toHaveLength(3);
  });
  it("still schedules a payment for a role shorter than one period", async () => {
    state.job.ends_at = "2026-01-03T00:00:00Z";
    state.engagement.amount_per_period = 200;
    await ensureEngagementSchedule("e1", 10);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].worker_amount).toBeGreaterThan(0);
  });
});
