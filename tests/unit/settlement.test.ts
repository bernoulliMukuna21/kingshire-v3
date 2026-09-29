import { describe, it, expect } from "vitest";
import {
  addPeriods,
  periodDueDate,
  periodEnd,
  releaseNoticeDays,
  plannedPeriodIndexes,
} from "@/lib/settlement/schedule";
import {
  periodFees,
  meetsMinimumPeriodAmount,
  meetsMinimumPeriodCharge,
  MIN_PERIOD_AMOUNT_GBP,
} from "@/lib/settlement/fees";

const day = (d: Date) => d.toISOString().slice(0, 10);
const anchor = new Date("2026-01-01T00:00:00.000Z");

describe("settlement schedule", () => {
  it("advances weekly by 7 days and monthly by a calendar month", () => {
    expect(day(addPeriods(anchor, 1, "weekly"))).toBe("2026-01-08");
    expect(day(addPeriods(anchor, 2, "weekly"))).toBe("2026-01-15");
    expect(day(addPeriods(anchor, 1, "monthly"))).toBe("2026-02-01");
    expect(day(addPeriods(anchor, 3, "monthly"))).toBe("2026-04-01");
  });

  it("clamps month-end anchors instead of overflowing into the month after next", () => {
    const jan31 = new Date("2026-01-31T00:00:00.000Z");
    // Feb 2026 has 28 days — native setUTCMonth would roll this to Mar 2/3.
    expect(day(addPeriods(jan31, 1, "monthly"))).toBe("2026-02-28");
    expect(day(addPeriods(jan31, 2, "monthly"))).toBe("2026-03-31");
    const mar30 = new Date("2026-03-30T00:00:00.000Z");
    expect(day(addPeriods(mar30, 1, "monthly"))).toBe("2026-04-30");
  });

  it("makes period 1 due at the anchor and later periods step by cadence", () => {
    expect(day(periodDueDate(anchor, "weekly", 1))).toBe("2026-01-01");
    expect(day(periodDueDate(anchor, "weekly", 3))).toBe("2026-01-15");
    expect(day(periodDueDate(anchor, "monthly", 4))).toBe("2026-04-01");
  });

  it("ends a period one cadence step after it falls due", () => {
    expect(day(periodEnd(anchor, "weekly"))).toBe("2026-01-08");
    expect(day(periodEnd(anchor, "monthly"))).toBe("2026-02-01");
  });

  it("uses a shorter release notice for weekly than monthly", () => {
    expect(releaseNoticeDays("weekly")).toBe(2);
    expect(releaseNoticeDays("monthly")).toBe(7);
  });

  it("plans a bounded schedule and an open-ended rolling window", () => {
    expect(plannedPeriodIndexes({ durationPeriods: 3 })).toEqual([1, 2, 3]);
    expect(plannedPeriodIndexes({ durationPeriods: 3, fromIndex: 2 })).toEqual([
      2, 3,
    ]);
    expect(plannedPeriodIndexes({ durationPeriods: null })).toEqual([1]);
    expect(
      plannedPeriodIndexes({
        durationPeriods: null,
        fromIndex: 5,
        rollingCount: 1,
      }),
    ).toEqual([5]);
  });
});

describe("settlement fees", () => {
  it("managed: org charged pay + 2.5%, worker receives pay − 5%", () => {
    const f = periodFees({ amountPerPeriod: 200, mode: "managed" });
    expect(f.workerAmount).toBe(200);
    expect(f.platformFeeClient).toBe(5);
    expect(f.platformFeeKinglancer).toBe(10);
    expect(f.orgChargeGBP).toBe(205);
  });

  it("direct: worker off-platform (0), org charged only the facilitation fee", () => {
    const f = periodFees({ amountPerPeriod: 200, mode: "direct" });
    expect(f.workerAmount).toBe(0);
    expect(f.platformFeeClient).toBe(5);
    expect(f.platformFeeKinglancer).toBe(10);
    expect(f.orgChargeGBP).toBe(15);
  });

  it("enforces the £10 per-period minimum", () => {
    expect(MIN_PERIOD_AMOUNT_GBP).toBe(10);
    expect(meetsMinimumPeriodAmount(10)).toBe(true);
    expect(meetsMinimumPeriodAmount(9.99)).toBe(false);
  });

  it("checks the actual charge, not the raw pay amount — a direct role only charges its fee", () => {
    // £100/period passes meetsMinimumPeriodAmount but the org is only charged
    // the 7.5% facilitation fee (£7.50) in direct mode — below the £10 floor.
    expect(meetsMinimumPeriodAmount(100)).toBe(true);
    expect(meetsMinimumPeriodCharge(100, "direct")).toBe(false);
    expect(meetsMinimumPeriodCharge(100, "managed")).toBe(true);
    // A direct role needs enough pay that 7.5% of it clears £10.
    expect(meetsMinimumPeriodCharge(133, "direct")).toBe(false);
    expect(meetsMinimumPeriodCharge(134, "direct")).toBe(true);
  });
});
