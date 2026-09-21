import { describe, it, expect } from "vitest";
import { isJobReviewSettled, isReviewWindowClosed } from "@/lib/db/reviews";

describe("isJobReviewSettled", () => {
  it("is NOT settled while approved but the payout is unreleased (manual payout gap)", () => {
    expect(isJobReviewSettled({ status: "approved", releasedAt: null })).toBe(
      false,
    );
  });

  it("is settled once an approved job's payout is released", () => {
    expect(
      isJobReviewSettled({
        status: "approved",
        releasedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it("is never settled before approval", () => {
    expect(
      isJobReviewSettled({
        status: "completed",
        releasedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(
      isJobReviewSettled({ status: "in_progress", releasedAt: null }),
    ).toBe(false);
  });
});

describe("isReviewWindowClosed", () => {
  it("treats an unreleased job as not-closed (the window hasn't started)", () => {
    expect(isReviewWindowClosed(null)).toBe(false);
  });

  it("is open within 7 days of release and closed after", () => {
    const day = 24 * 60 * 60 * 1000;
    const twoDaysAgo = new Date(Date.now() - 2 * day).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * day).toISOString();
    expect(isReviewWindowClosed(twoDaysAgo)).toBe(false);
    expect(isReviewWindowClosed(eightDaysAgo)).toBe(true);
  });
});
