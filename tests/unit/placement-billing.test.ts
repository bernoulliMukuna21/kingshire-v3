import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocked external dependencies, controlled per test.
const state = vi.hoisted(() => ({
  customerId: "cus_1" as string | null,
  customer: {
    deleted: false,
    invoice_settings: { default_payment_method: "pm_1" as unknown },
  } as unknown as {
    deleted: boolean;
    invoice_settings: { default_payment_method: unknown };
  },
  cards: [{ id: "pm_list" }] as { id: string }[],
  piResult: { id: "pi_1", status: "succeeded" } as {
    id: string;
    status: string;
  },
  piThrows: false,
}));

const createIntent = vi.hoisted(() => vi.fn());
const updateStatus = vi.hoisted(() => vi.fn());
const fulfill = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: state.customerId
              ? { stripe_customer_id: state.customerId }
              : null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { retrieve: async () => state.customer },
    paymentMethods: { list: async () => ({ data: state.cards }) },
    paymentIntents: {
      create: async (...args: unknown[]) => {
        createIntent(...args);
        if (state.piThrows) throw new Error("card_declined");
        return state.piResult;
      },
    },
  },
}));

vi.mock("@/lib/db/placement-payments", () => ({
  updatePlacementPaymentStatus: (...args: unknown[]) => {
    updateStatus(...args);
    return Promise.resolve();
  },
}));

vi.mock("@/lib/placement-payouts", () => ({
  fulfillPlacementPayment: (...args: unknown[]) => {
    fulfill(...args);
    return Promise.resolve();
  },
}));

import { chargeDuePlacementPayment } from "@/lib/placement-billing";

const payment = {
  id: "pay_1",
  agreement_id: "ag_1",
  organisation_id: "org_1",
  kinglancer_id: "kl_1",
  period_index: 1,
  amount: "500",
  platform_fee_client: "25.30",
  platform_fee_kinglancer: "37.50",
  status: "due",
} as never;

describe("chargeDuePlacementPayment", () => {
  beforeEach(() => {
    state.customerId = "cus_1";
    state.customer = {
      deleted: false,
      invoice_settings: { default_payment_method: "pm_1" },
    };
    state.cards = [{ id: "pm_list" }];
    state.piResult = { id: "pi_1", status: "succeeded" };
    state.piThrows = false;
    createIntent.mockClear();
    updateStatus.mockClear();
    fulfill.mockClear();
  });

  it("charges the saved card and fulfils on success", async () => {
    const result = await chargeDuePlacementPayment(payment);
    expect(result).toBe("charged");
    // amount = (500 + 25.30) * 100 = 52530 pence, off-session, confirmed.
    expect(createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 52530,
        currency: "gbp",
        off_session: true,
        confirm: true,
        metadata: expect.objectContaining({ purpose: "placement_payment" }),
      }),
      expect.objectContaining({ idempotencyKey: "placement-charge-pay_1" }),
    );
    expect(fulfill).toHaveBeenCalledWith("pay_1", "pi_1");
  });

  it("skips charging when the org has no saved card", async () => {
    state.customerId = null;
    const result = await chargeDuePlacementPayment(payment);
    expect(result).toBe("no_payment_method");
    expect(createIntent).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("marks the payment failed when the card is declined", async () => {
    state.piThrows = true;
    const result = await chargeDuePlacementPayment(payment);
    expect(result).toBe("failed");
    expect(fulfill).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("pay_1", { status: "failed" });
  });

  it("marks failed when the PaymentIntent needs further action", async () => {
    state.piResult = { id: "pi_2", status: "requires_action" };
    const result = await chargeDuePlacementPayment(payment);
    expect(result).toBe("failed");
    expect(fulfill).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("pay_1", {
      status: "failed",
      stripe_payment_intent_id: "pi_2",
    });
  });
});
