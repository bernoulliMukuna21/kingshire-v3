import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  charge: vi.fn(),
  reconcile: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getRecoverablePayments: async () => [
    { id: "failed-first", status: "processing", attempt_kind: "automatic" },
    { id: "paid-second", status: "held", stripe_payment_intent_id: "pi2" },
    { id: "open-third", status: "processing", attempt_kind: "checkout" },
    { id: "legacy-fourth", status: "processing" },
  ],
}));
vi.mock("@/lib/settlement/billing", () => ({
  chargeEngagementPayment: mocks.charge,
  reconcileEngagementPayment: mocks.reconcile,
}));
vi.mock("@/lib/settlement/checkout", () => ({
  resumeEngagementCheckout: mocks.checkout,
}));
import { recoverEngagementPayments } from "@/lib/settlement/recovery";

describe("payment recovery isolation", () => {
  it("continues after one Stripe failure and surfaces legacy unknown attempts", async () => {
    mocks.charge.mockRejectedValue(new Error("Stripe unavailable"));
    const summary = await recoverEngagementPayments();
    expect(summary.checked).toBe(4);
    expect(mocks.reconcile).toHaveBeenCalledWith("paid-second", "pi2");
    expect(mocks.checkout).toHaveBeenCalled();
    expect(summary.errors).toEqual([
      "failed-first: Stripe unavailable",
      "legacy-fourth: legacy attempt requires reconciliation",
    ]);
  });
});
