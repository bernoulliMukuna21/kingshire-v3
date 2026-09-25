import { beforeEach, describe, expect, it, vi } from "vitest";

const charge = vi.hoisted(() => vi.fn());
const fulfill = vi.hoisted(() => vi.fn());

vi.mock("@/lib/settlement/billing", () => ({
  chargeEngagementPayment: charge,
  getOrganisationStripePaymentContext: vi.fn(),
}));
vi.mock("@/lib/placement-payouts", () => ({
  fulfillPlacementPayment: fulfill,
}));

import { chargeDuePlacementPayment } from "@/lib/placement-billing";

const payment = { id: "eng-payment-1" } as never;

describe("chargeDuePlacementPayment", () => {
  beforeEach(() => {
    charge.mockReset();
    fulfill.mockReset();
  });

  it("delegates a successful Placement charge to the shared engine", async () => {
    charge.mockResolvedValueOnce("charged");
    const result = await chargeDuePlacementPayment(payment);
    expect(result).toBe("charged");
    expect(charge).toHaveBeenCalledWith("eng-payment-1");
    // Fulfilment belongs to the shared engine; do not run a second hook
    // with a null PaymentIntent or activate an agreement prematurely.
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("preserves no-payment-method semantics", async () => {
    charge.mockResolvedValueOnce("no_payment_method");
    await expect(chargeDuePlacementPayment(payment)).resolves.toBe(
      "no_payment_method",
    );
  });

  it("preserves uncertain outcomes without reporting a failed charge", async () => {
    charge.mockResolvedValueOnce("reconciliation_pending");
    await expect(chargeDuePlacementPayment(payment)).resolves.toBe(
      "reconciliation_pending",
    );
  });

  it("maps shared failures to the Placement contract", async () => {
    charge.mockResolvedValueOnce("failed");
    await expect(chargeDuePlacementPayment(payment)).resolves.toBe("failed");
    expect(fulfill).not.toHaveBeenCalled();
  });
});
