import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  payment: {} as Record<string, unknown>,
  engagement: {} as Record<string, unknown>,
  agreement: {} as Record<string, unknown>,
  activate: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayment: async () => ({ ...state.payment }),
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: async () => ({ ...state.engagement }),
  markEngagementActive: state.activate,
}));
vi.mock("@/lib/settlement/schedules", () => ({
  ensureEngagementSchedule: state.schedule,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => {
        const row =
          table === "engagement_payments" ? state.payment : state.agreement;
        let matches = true;
        const query = {
          eq: (key: string, value: unknown) => {
            matches &&= row[key] === value;
            return query;
          },
          in: (key: string, values: unknown[]) => {
            matches &&= values.includes(row[key]);
            return query;
          },
          or: () => query,
          then: (resolve: (value: { error: null }) => unknown) => {
            if (matches) Object.assign(row, patch);
            return Promise.resolve(resolve({ error: null }));
          },
        };
        return query;
      },
    }),
  }),
}));
import { fulfilEngagementPayment } from "@/lib/settlement/fulfilment";

describe("resumable payment fulfilment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.payment = {
      id: "p1",
      engagement_id: "e1",
      period_index: 1,
      status: "processing",
      fulfilled_at: null,
      stripe_payment_intent_id: null,
    };
    state.engagement = {
      id: "e1",
      source_kind: "org_role",
      source_id: "job1",
      settlement_mode: "managed",
    };
    state.agreement = {
      id: "agreement1",
      status: "pending_funding",
      kinglancer_signed_at: "2026-01-01",
    };
    state.activate.mockResolvedValue(undefined);
    state.schedule.mockResolvedValue({ created: 1 });
  });
  it("resumes activation after the payment write succeeded but activation failed", async () => {
    state.activate.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(fulfilEngagementPayment("p1", "pi1")).rejects.toThrow(
      "database unavailable",
    );
    expect(state.payment.status).toBe("held");
    expect(state.payment.fulfilled_at).toBeNull();
    await fulfilEngagementPayment("p1", "pi1");
    expect(state.activate).toHaveBeenCalledTimes(2);
    expect(state.schedule).toHaveBeenCalledWith("e1", 2);
    expect(state.payment.fulfilled_at).toBeTruthy();
  });
  it("keeps schedule failures retryable and skips completed fulfilment", async () => {
    state.schedule.mockRejectedValueOnce(new Error("schedule unavailable"));
    await expect(fulfilEngagementPayment("p1", "pi1")).rejects.toThrow();
    expect(state.payment.fulfilled_at).toBeNull();
    await fulfilEngagementPayment("p1", "pi1");
    await fulfilEngagementPayment("p1", "pi1");
    expect(state.schedule).toHaveBeenCalledTimes(2);
  });
  it("activates the placement agreement without overwriting the acceptance timestamp", async () => {
    Object.assign(state.engagement, {
      source_kind: "placement",
      source_id: "agreement1",
    });
    await fulfilEngagementPayment("p1", "pi1");
    expect(state.agreement.status).toBe("active");
    expect(state.agreement.kinglancer_signed_at).toBe("2026-01-01");
    expect(state.schedule).not.toHaveBeenCalled();
  });
  it("does not rewind a released, disputed or refunded ledger row", async () => {
    Object.assign(state.payment, {
      status: "released",
      stripe_payment_intent_id: "pi1",
      released_at: "original",
    });
    await fulfilEngagementPayment("p1", "pi1");
    expect(state.payment.status).toBe("released");
    expect(state.payment.released_at).toBe("original");
    for (const status of ["disputed", "refunded"]) {
      Object.assign(state.payment, { status, fulfilled_at: null });
      await fulfilEngagementPayment("p1", "pi1");
      expect(state.payment.status).toBe(status);
      expect(state.payment.fulfilled_at).toBeNull();
    }
  });
  it("rejects a different PaymentIntent instead of replacing the payment proof", async () => {
    state.payment.stripe_payment_intent_id = "original";
    await expect(fulfilEngagementPayment("p1", "other")).rejects.toThrow(
      "does not match",
    );
    expect(state.payment.stripe_payment_intent_id).toBe("original");
  });
});
