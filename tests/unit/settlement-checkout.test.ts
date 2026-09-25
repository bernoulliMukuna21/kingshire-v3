import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  payment: {} as Record<string, unknown>,
  sessions: new Map<
    string,
    { id: string; status: string; payment_status: string; url: string }
  >(),
  create: vi.fn(),
  retrieve: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      update: (patch: object) => {
        let matches = true;
        const query = {
          eq: (key: string, value: unknown) => {
            matches &&= mocks.payment[key] === value;
            return query;
          },
          then: (resolve: (value: { error: null }) => unknown) => {
            if (matches) Object.assign(mocks.payment, patch);
            return Promise.resolve(resolve({ error: null }));
          },
        };
        return query;
      },
    }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } },
  },
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: async () => ({
    source_kind: "placement",
    source_id: "agreement1",
  }),
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayment: async () => ({ ...mocks.payment }),
  reserveEngagementPayment: async (_id: string, kind: string) => {
    if (mocks.payment.status !== "due") return null;
    Object.assign(mocks.payment, {
      status: "processing",
      attempt_id: "attempt1",
      attempt_kind: kind,
      attempt_started_at: new Date().toISOString(),
    });
    return { ...mocks.payment };
  },
  patchPaymentAttempt: async (_payment: unknown, patch: object) => {
    Object.assign(mocks.payment, patch);
  },
}));
vi.mock("@/lib/settlement/billing", () => ({
  canRecoverCreation: () => true,
  reconcileEngagementPayment: mocks.reconcile,
}));
import { startEngagementCheckout } from "@/lib/settlement/checkout";

describe("one checkout attempt per period", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessions.clear();
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
    mocks.payment = {
      id: "payment1",
      engagement_id: "e1",
      period_index: 1,
      status: "due",
      worker_amount: 100,
      platform_fee_client: 2.5,
    };
    mocks.create.mockImplementation(async (_params, options) => {
      let session = mocks.sessions.get(options.idempotencyKey);
      if (!session) {
        session = {
          id: "cs1",
          status: "open",
          payment_status: "unpaid",
          url: "https://checkout.test/1",
        };
        mocks.sessions.set(options.idempotencyKey, session);
      }
      return session;
    });
    mocks.retrieve.mockImplementation(
      async () => [...mocks.sessions.values()][0],
    );
  });
  it("double clicks converge on one Stripe session and subsequent calls reuse it", async () => {
    const urls = await Promise.all([
      startEngagementCheckout("payment1"),
      startEngagementCheckout("payment1"),
    ]);
    expect(urls).toEqual([
      "https://checkout.test/1",
      "https://checkout.test/1",
    ]);
    expect(mocks.sessions.size).toBe(1);
    const calls = mocks.create.mock.calls.length;
    await startEngagementCheckout("payment1");
    expect(mocks.create).toHaveBeenCalledTimes(calls);
    expect(mocks.retrieve).toHaveBeenCalled();
  });
  it("does not start checkout while an automatic attempt owns the payment", async () => {
    Object.assign(mocks.payment, {
      status: "processing",
      attempt_kind: "automatic",
      attempt_id: "auto1",
    });
    expect(await startEngagementCheckout("payment1")).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not reset a legacy processing payment with unknown outcome", async () => {
    mocks.payment.status = "processing";
    expect(await startEngagementCheckout("payment1")).toBeNull();
    expect(mocks.payment.status).toBe("processing");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("only releases a reservation after Stripe confirms session expiration", async () => {
    await startEngagementCheckout("payment1");
    await startEngagementCheckout("payment1");
    expect(mocks.payment.status).toBe("processing");
    mocks.retrieve.mockResolvedValueOnce({
      id: "cs1",
      status: "expired",
      payment_status: "unpaid",
    });
    await startEngagementCheckout("payment1");
    expect(mocks.payment.status).toBe("due");
    expect(mocks.payment.attempt_id).toBeNull();
  });

  it("fulfils a completed Checkout rather than opening another session", async () => {
    await startEngagementCheckout("payment1");
    mocks.retrieve.mockResolvedValueOnce({
      id: "cs1",
      status: "complete",
      payment_status: "paid",
      payment_intent: "pi1",
    });
    expect(await startEngagementCheckout("payment1")).toBeNull();
    expect(mocks.reconcile).toHaveBeenCalledWith("payment1", "pi1");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
