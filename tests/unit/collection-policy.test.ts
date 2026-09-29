import { describe, expect, it } from "vitest";
import { canCollectEngagementPayment } from "@/lib/settlement/collection-policy";

describe("canCollectEngagementPayment", () => {
  it("collects while active and not held", () => {
    expect(
      canCollectEngagementPayment({ status: "active" }),
    ).toBe(true);
  });
  it("collects while awaiting funding", () => {
    expect(
      canCollectEngagementPayment({ status: "pending_funding" }),
    ).toBe(true);
  });
  it("does not collect while a settlement hold is in place", () => {
    expect(
      canCollectEngagementPayment({
        status: "active",
        settlement_hold_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
  it("does not collect an engagement that has no row", () => {
    expect(canCollectEngagementPayment(null)).toBe(false);
  });
  it("does not collect an early-terminated engagement", () => {
    expect(
      canCollectEngagementPayment({ status: "ended", termination_kind: "early" }),
    ).toBe(false);
  });
  it("does not collect a legacy engagement with no termination_kind", () => {
    expect(
      canCollectEngagementPayment({ status: "ended", termination_kind: null }),
    ).toBe(false);
  });
  it("still collects earned periods after natural completion", () => {
    expect(
      canCollectEngagementPayment({
        status: "ended",
        termination_kind: "completed",
      }),
    ).toBe(true);
  });
  it("still collects earned periods after natural completion even with a hold", () => {
    expect(
      canCollectEngagementPayment({
        status: "ended",
        termination_kind: "completed",
        settlement_hold_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});