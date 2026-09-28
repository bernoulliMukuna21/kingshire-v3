import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  payment: {
    id: "p1",
    release_attempt_id: "attempt1",
    release_operation: "admin",
    worker_amount: 100,
    platform_fee_client: 5,
    platform_fee_kinglancer: 5,
    stripe_payment_intent_id: "pi_1",
    kinglancer_id: "worker",
    status: "disputed",
  },
  update: vi.fn(),
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayment: async () => state.payment,
  reserveEngagementRelease: vi.fn(async () => ({ attemptId: "attempt1" })),
  updateEngagementPaymentStatusIf: vi.fn(async () => ({ id: "p1" })),
  recordSettlementError: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        update: (patch: unknown) => {
          state.update(patch);
          return query;
        },
        eq: () => query,
        in: () => query,
        single: async () => ({
          data: { stripe_account_id: "acct_1" },
          error: null,
        }),
        maybeSingle: async () => ({ data: { id: "p1" }, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: { retrieve: vi.fn(), create: vi.fn() },
    refunds: { retrieve: vi.fn(), create: vi.fn() },
  },
}));
import { stripe } from "@/lib/stripe";
import { reconcileSettlementOutcome } from "@/lib/settlement/reconciliation";
import { refundEngagementPayment } from "@/lib/settlement/refunds";
import {
  recordSettlementError,
  updateEngagementPaymentStatusIf,
} from "@/lib/db/engagement-payments";
beforeEach(() => {
  vi.clearAllMocks();
  state.payment.release_operation = "admin";
  vi.mocked(stripe.transfers.retrieve).mockResolvedValue({
    id: "tr_1",
    metadata: { engagement_payment_id: "p1" },
    amount: 9500,
    currency: "gbp",
    destination: "acct_1",
    reversed: false,
    amount_reversed: 0,
    created: 1000,
  } as never);
});
it("reconciles an existing matching transfer without moving money", async () => {
  await reconcileSettlementOutcome("p1", "tr_1");
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "released", stripe_transfer_id: "tr_1" }),
  );
  expect(stripe.transfers.create).not.toHaveBeenCalled();
  expect(stripe.refunds.create).not.toHaveBeenCalled();
});
it("rejects a transfer belonging to another payment", async () => {
  vi.mocked(stripe.transfers.retrieve).mockResolvedValueOnce({
    metadata: { engagement_payment_id: "other" },
  } as never);
  await expect(reconcileSettlementOutcome("p1", "tr_wrong")).rejects.toThrow(
    "does not match",
  );
  expect(state.update).not.toHaveBeenCalled();
});
it("rejects a refund for an uncertain transfer operation", async () => {
  await expect(reconcileSettlementOutcome("p1", "re_wrong")).rejects.toThrow(
    "Conflicting transfer",
  );
  expect(stripe.refunds.retrieve).not.toHaveBeenCalled();
});
it("does not mark a pending refund as settled", async () => {
  vi.mocked(stripe.refunds.create).mockResolvedValueOnce({
    id: "re_1",
    status: "pending",
  } as never);
  await expect(refundEngagementPayment("p1")).rejects.toThrow(
    "pending reconciliation",
  );
  expect(updateEngagementPaymentStatusIf).not.toHaveBeenCalled();
  expect(recordSettlementError).toHaveBeenCalledWith("p1", "attempt1");
});
it("requires a completed full refund before recording reconciliation", async () => {
  state.payment.release_operation = "refund";
  vi.mocked(stripe.refunds.retrieve).mockResolvedValueOnce({
    id: "re_1",
    status: "succeeded",
    payment_intent: "pi_1",
    amount: 10500,
    currency: "gbp",
  } as never);
  await reconcileSettlementOutcome("p1", "re_1");
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "refunded", stripe_refund_id: "re_1" }),
  );
});
