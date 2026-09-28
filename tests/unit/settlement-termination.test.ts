import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  payments: [] as Array<{ id: string; status: string }>,
}));

vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayments: async () => state.payments,
  updateEngagementPaymentStatus: vi.fn().mockResolvedValue(null),
  updateEngagementPaymentStatusIf: vi.fn().mockResolvedValue(null),
}));

import {
  updateEngagementPaymentStatus,
  updateEngagementPaymentStatusIf,
} from "@/lib/db/engagement-payments";
import { settleEngagementPaymentsOnEarlyEnd } from "@/lib/settlement/termination";

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
    expect(updateEngagementPaymentStatus).toHaveBeenCalledWith(
      "p-due",
      "cancelled",
    );
    expect(updateEngagementPaymentStatus).toHaveBeenCalledWith(
      "p-failed",
      "cancelled",
    );
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
    expect(updateEngagementPaymentStatus).not.toHaveBeenCalled();
    expect(updateEngagementPaymentStatusIf).not.toHaveBeenCalled();
  });
});
