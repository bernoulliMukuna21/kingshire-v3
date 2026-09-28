import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  failSave: false,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      let patch: Record<string, unknown> | undefined;
      const filters: [string, unknown][] = [];
      function result() {
        if (!filters.every(([key, value]) => state.row[key] === value))
          return { data: null, error: null };
        if (patch && state.failSave && patch.stripe_transfer_id)
          return { data: null, error: new Error("database offline") };
        if (patch) Object.assign(state.row, patch);
        return { data: { ...state.row }, error: null };
      }
      const query = {
        select: () => query,
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { transfers: { create: vi.fn() }, refunds: { create: vi.fn() } },
}));
import { stripe } from "@/lib/stripe";
import {
  dispatchSettlement,
  retrySettlement,
  confirmedSettlementFailure,
} from "@/lib/settlement/dispatch";
import {
  deriveRecoveryView,
  type RecoveryState,
} from "@/lib/settlement/recovery-view";
const request = {
  kind: "transfer" as const,
  params: {
    amount: 9500,
    currency: "gbp" as const,
    destination: "acct_1",
    source_transaction: "ch_1",
    metadata: { transaction_id: "p1" },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  state.row = {
    id: "p1",
    release_attempt_id: "attempt1",
    release_outcome: "reserved",
    release_dispatch_started_at: null,
    stripe_transfer_id: null,
    stripe_refund_id: null,
  };
  state.failSave = false;
  vi.mocked(stripe.transfers.create).mockResolvedValue({ id: "tr_1" } as never);
});
it("persists the exact request before dispatching", async () => {
  vi.mocked(stripe.transfers.create).mockImplementationOnce(async () => {
    expect(state.row.release_request).toEqual(request);
    expect(state.row.release_outcome).toBe("dispatched");
    return { id: "tr_1" } as never;
  });
  await dispatchSettlement("transactions", "p1", "attempt1", request);
  expect(state.row.stripe_transfer_id).toBe("tr_1");
  expect(state.row.release_outcome).toBe("confirmed");
});
it("fences a stale worker after the reservation changes", async () => {
  state.row.release_attempt_id = "replacement";
  await expect(
    dispatchSettlement("transactions", "p1", "attempt1", request),
  ).rejects.toThrow("nothing dispatched");
  expect(stripe.transfers.create).not.toHaveBeenCalled();
});
it("does not turn a lost Stripe response into permission to reset", async () => {
  vi.mocked(stripe.transfers.create).mockRejectedValueOnce(
    new Error("timeout"),
  );
  await expect(
    dispatchSettlement("transactions", "p1", "attempt1", request),
  ).rejects.toThrow("timeout");
  expect(state.row.release_outcome).toBe("dispatched");
  expect(deriveRecoveryView(state.row as RecoveryState).canReset).toBe(false);
  await retrySettlement("transactions", "p1", "attempt1");
  expect(vi.mocked(stripe.transfers.create).mock.calls[0]).toEqual(
    vi.mocked(stripe.transfers.create).mock.calls[1],
  );
});
it("keeps external success uncertain when saving the result fails", async () => {
  state.failSave = true;
  await expect(
    dispatchSettlement("transactions", "p1", "attempt1", request),
  ).rejects.toThrow("database offline");
  expect(state.row.release_outcome).toBe("dispatched");
  expect(deriveRecoveryView(state.row as RecoveryState).canReset).toBe(false);
});
it("allows reset only for a confirmed balance rejection", async () => {
  const failure = {
    type: "StripeInvalidRequestError",
    code: "balance_insufficient",
    statusCode: 400,
    requestId: "req_1",
  };
  expect(confirmedSettlementFailure({ ...failure, requestId: undefined })).toBe(
    false,
  );
  expect(confirmedSettlementFailure({ ...failure, statusCode: 500 })).toBe(
    false,
  );
  vi.mocked(stripe.transfers.create).mockRejectedValueOnce(failure);
  await expect(
    dispatchSettlement("transactions", "p1", "attempt1", request),
  ).rejects.toEqual(failure);
  expect(deriveRecoveryView(state.row as RecoveryState).canReset).toBe(true);
});
it("blocks replay outside the retention safety window", async () => {
  await dispatchSettlement("transactions", "p1", "attempt1", request);
  vi.mocked(stripe.transfers.create).mockClear();
  state.row.release_dispatch_started_at = new Date(
    Date.now() - 21 * 3600000,
  ).toISOString();
  await expect(
    retrySettlement("transactions", "p1", "attempt1"),
  ).rejects.toThrow("Retry window closed");
  expect(stripe.transfers.create).not.toHaveBeenCalled();
});
it("does not offer a reset for legacy reservations with an unknown outcome", () => {
  state.row.release_outcome = null;
  expect(deriveRecoveryView(state.row as RecoveryState).canReset).toBe(false);
});
