import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  payment: {} as Record<string, unknown>,
  engagement: {} as Record<string, unknown>,
  create: vi.fn(),
  retrieve: vi.fn(),
  confirm: vi.fn(),
  fulfil: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { stripe_customer_id: "cus1" } }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      retrieve: async () => ({
        invoice_settings: { default_payment_method: "pm1" },
      }),
    },
    paymentIntents: {
      create: m.create,
      retrieve: m.retrieve,
      confirm: m.confirm,
    },
  },
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: async () => m.engagement,
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getEngagementPayment: async () => ({ ...m.payment }),
  reserveEngagementPayment: async (_id: string, kind: string) => {
    if (m.payment.status !== "due" && m.payment.status !== "failed")
      return null;
    Object.assign(m.payment, {
      status: "processing",
      attempt_kind: kind,
      attempt_id: "a1",
      attempt_started_at: new Date().toISOString(),
      attempt_customer_id: "cus1",
      attempt_payment_method_id: "pm1",
    });
    return { ...m.payment };
  },
  patchPaymentAttempt: async (_payment: unknown, patch: object) => {
    Object.assign(m.payment, patch);
  },
}));
vi.mock("@/lib/settlement/fulfilment", () => ({
  fulfilEngagementPayment: m.fulfil,
}));
import {
  chargeEngagementPayment,
  reconcileEngagementPayment,
} from "@/lib/settlement/billing";

const succeeded = () => ({
  id: "pi1",
  status: "succeeded",
  amount: 10250,
  currency: "gbp",
  metadata: { engagement_payment_id: "p1" },
});
describe("durable automatic payment attempts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.payment = {
      id: "p1",
      engagement_id: "e1",
      organisation_id: "o1",
      status: "due",
      worker_amount: 100,
      platform_fee_client: 2.5,
    };
    m.engagement = {
      id: "e1",
      source_kind: "org_role",
      status: "active",
      settlement_mode: "managed",
    };
    m.create.mockResolvedValue({ id: "pi1", status: "requires_confirmation" });
    m.retrieve.mockResolvedValue(succeeded());
    m.confirm.mockImplementation(async () => {
      expect(m.payment.stripe_payment_intent_id).toBe("pi1");
      return succeeded();
    });
    m.fulfil.mockResolvedValue(undefined);
  });
  it("stores the PaymentIntent before confirmation and never creates another on recovery", async () => {
    expect(await chargeEngagementPayment("p1")).toBe("charged");
    expect(m.create.mock.calls[0][0].confirm).toBeUndefined();
    expect(await chargeEngagementPayment("p1")).toBe("charged");
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("preserves an uncertain confirmation for retrieval instead of resetting to due", async () => {
    m.confirm.mockRejectedValueOnce(new Error("connection interrupted"));
    await expect(chargeEngagementPayment("p1")).rejects.toThrow(
      "connection interrupted",
    );
    expect(m.payment.status).toBe("processing");
    expect(m.payment.stripe_payment_intent_id).toBe("pi1");
    await chargeEngagementPayment("p1");
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.fulfil).toHaveBeenCalledWith("p1", "pi1");
  });
  it("does not automatically fund the first placement month", async () => {
    Object.assign(m.engagement, {
      source_kind: "placement",
      status: "pending_funding",
    });
    expect(await chargeEngagementPayment("p1")).toBe("not_chargeable");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("reconciles already held payments whose remaining effects failed", async () => {
    Object.assign(m.payment, {
      status: "held",
      stripe_payment_intent_id: "pi1",
    });
    await reconcileEngagementPayment("p1", "pi1");
    expect(m.fulfil).toHaveBeenCalledWith("p1", "pi1");
  });
  it("does not recreate an unidentified attempt beyond the idempotency window", async () => {
    Object.assign(m.payment, {
      status: "processing",
      attempt_kind: "automatic",
      attempt_id: "a1",
      attempt_customer_id: "cus1",
      attempt_payment_method_id: "pm1",
      attempt_started_at: "2020-01-01T00:00:00Z",
    });
    expect(await chargeEngagementPayment("p1")).toBe("reconciliation_pending");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects incorrect amounts and cross-payment events", async () => {
    m.retrieve.mockResolvedValue({ ...succeeded(), amount: 1 });
    await expect(reconcileEngagementPayment("p1", "pi1")).rejects.toThrow(
      "does not match",
    );
    m.retrieve.mockResolvedValue({
      ...succeeded(),
      metadata: { engagement_payment_id: "other" },
    });
    await expect(reconcileEngagementPayment("p1", "pi1")).rejects.toThrow(
      "does not match",
    );
    expect(m.fulfil).not.toHaveBeenCalled();
  });
  it("does not create a fresh charge for an unidentified legacy failure", async () => {
    m.payment.status = "failed";
    expect(await chargeEngagementPayment("p1")).toBe("reconciliation_pending");
    expect(m.create).not.toHaveBeenCalled();
  });
});
