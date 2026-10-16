import { beforeEach, describe, it, expect, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  failed: new Set<string>(),
  calls: [] as string[],
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/admin/access", () => ({
  getAdminDb: async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "in", "eq", "order"])
        builder[method] = () => builder;
      builder.range = (from: number, to: number) => {
        fixture.calls.push(table);
        return Promise.resolve({
          data: fixture.failed.has(table)
            ? null
            : (fixture.tables[table] ?? []).slice(from, to + 1),
          error: fixture.failed.has(table) ? { message: "unavailable" } : null,
        });
      };
      return builder;
    },
  }),
}));
import { getAdminQueues } from "@/lib/admin/queues";
const job = {
  id: "job",
  title: "Cleaning",
  status: "approved",
  created_at: "2026-10-01",
};
const payment = {
  id: "pay",
  job_id: "job",
  status: "held",
  payment_method: "card",
  payout_method: "manual",
  release_attempt_id: null,
  release_outcome: null,
  stripe_transfer_id: null,
  manual_payout_reference: null,
  stripe_refund_id: null,
  created_at: "2026-10-01",
};
describe("complete admin queue snapshot", () => {
  beforeEach(() => {
    fixture.tables = {};
    fixture.failed.clear();
    fixture.calls = [];
  });
  it("counts every case beyond the preview limit and database page size", async () => {
    fixture.tables.disputes = Array.from({ length: 205 }, (_, i) => ({
      id: `case${i}`,
      job_id: `job${i}`,
      reason: "Review",
      created_at: "2026-10-01",
    }));
    const result = await getAdminQueues();
    expect(result.actionCount).toBe(205);
    expect(result.items.length).toBe(205);
    expect(fixture.calls.filter((table) => table === "disputes")).toHaveLength(
      2,
    );
  });
  it("completed jobs are waiting on clients, not admin approval tasks", async () => {
    fixture.tables.jobs = [{ ...job, status: "completed" }];
    fixture.tables.transactions = [payment];
    const result = await getAdminQueues();
    expect(result.actionCount).toBe(0);
    expect(result.waitingCount).toBe(1);
  });
  it("recovery wins over the same payment's dispute and payout", async () => {
    fixture.tables.jobs = [job];
    fixture.tables.transactions = [
      {
        ...payment,
        release_attempt_id: "attempt",
        release_outcome: "dispatched",
      },
    ];
    fixture.tables.disputes = [
      { id: "case", job_id: "job", reason: "Review", created_at: "2026-10-01" },
    ];
    const result = await getAdminQueues();
    expect(result.actionCount).toBe(1);
    expect(result.items[0].id).toBe("recovery:pay");
  });
  it("paid workers are never offered a second payout", async () => {
    fixture.tables.jobs = [job];
    fixture.tables.transactions = [
      { ...payment, stripe_transfer_id: "tr_paid" },
    ];
    expect((await getAdminQueues()).items).toHaveLength(0);
  });
  it("shows partial failure explicitly and retains other providers", async () => {
    fixture.failed.add("disputes");
    fixture.tables.placements = [
      { id: "placement", title: "Review me", created_at: "2026-10-01" },
    ];
    const result = await getAdminQueues();
    expect(result.unavailable).toEqual(["disputes"]);
    expect(result.actionCount).toBe(1);
  });
  it("keeps role and placement cases distinct and deduplicates their engagement hold", async () => {
    fixture.tables.engagements = [
      {
        id: "role",
        source_kind: "org_role",
        status: "active",
        settlement_hold_at: "2026-10-01",
      },
      {
        id: "placement",
        source_kind: "placement",
        status: "active",
        settlement_hold_at: null,
      },
    ];
    fixture.tables.engagement_payments = [
      {
        id: "r",
        engagement_id: "role",
        status: "disputed",
        period_index: 1,
        created_at: "2026-10-01",
      },
      {
        id: "p",
        engagement_id: "placement",
        status: "disputed",
        period_index: 1,
        created_at: "2026-10-01",
      },
    ];
    const result = await getAdminQueues();
    expect(result.actionCount).toBe(2);
    expect(result.items.map((row) => row.title)).toEqual([
      "Placement payment · period 1",
      "Role payment · period 1",
    ]);
  });
});
