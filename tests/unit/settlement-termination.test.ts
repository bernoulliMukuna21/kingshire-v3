import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  payments: [] as Array<{ id: string; status: string }>,
}));

vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayments: async () => state.payments,
  cancelUnchargedEngagementPayment: vi.fn().mockResolvedValue(null),
  updateEngagementPaymentStatusIf: vi.fn().mockResolvedValue(null),
}));

import {
  cancelUnchargedEngagementPayment,
  updateEngagementPaymentStatusIf,
} from "@/lib/db/engagement-payments";
import {
  settleEngagementPaymentsOnEarlyEnd,
  cancelRemainingEngagementPayments,
} from "@/lib/settlement/termination";

describe("settleEngagementPaymentsOnEarlyEnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels 'due' and 'failed' periods so they are never retried", async () => {
    state.payments = [
      { id: "p-due", status: "due" },
      { id: "p-failed", status: "failed" },
    ];
    await settleEngagementPaymentsOnEarlyEnd("e-1", "ended early");
    expect(cancelUnchargedEngagementPayment).toHaveBeenCalledWith("p-due");
    expect(cancelUnchargedEngagementPayment).toHaveBeenCalledWith("p-failed");
  });

  it("sends a 'held' period to admin via a CAS dispute (doesn't stomp a racing release)", async () => {
    state.payments = [{ id: "p-held", status: "held" }];
    await settleEngagementPaymentsOnEarlyEnd("e-1", "ended early");
    expect(updateEngagementPaymentStatusIf).toHaveBeenCalledWith(
      "p-held",
      ["held"],
      "disputed",
      { dispute_reason: "ended early" },
      { requireReleaseAttemptId: null },
    );
  });

  it("leaves an in-flight 'processing' period alone (fulfilment routes it to disputed on completion)", async () => {
    state.payments = [{ id: "p-processing", status: "processing" }];
    await settleEngagementPaymentsOnEarlyEnd("e-1", "ended early");
    expect(cancelUnchargedEngagementPayment).not.toHaveBeenCalled();
    expect(updateEngagementPaymentStatusIf).not.toHaveBeenCalled();
  });
});

describe("cancelRemainingEngagementPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels due/failed periods but never touches a held one (normal completion shouldn't dispute a legitimate final month)", async () => {
    state.payments = [
      { id: "p-due", status: "due" },
      { id: "p-failed", status: "failed" },
      { id: "p-held", status: "held" },
    ];
    await cancelRemainingEngagementPayments("e-1");
    expect(cancelUnchargedEngagementPayment).toHaveBeenCalledWith("p-due");
    expect(cancelUnchargedEngagementPayment).toHaveBeenCalledWith("p-failed");
    expect(cancelUnchargedEngagementPayment).not.toHaveBeenCalledWith(
      "p-held",
      expect.anything(),
    );
    expect(updateEngagementPaymentStatusIf).not.toHaveBeenCalled();
  });
});
