import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  payment: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "engagement_payments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.payment, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  }),
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: vi.fn().mockResolvedValue({ settlement_mode: "managed" }),
}));
vi.mock("@/lib/db/engagement-payments", () => ({
  getHeldEngagementPayments: vi.fn().mockResolvedValue([]),
  updateEngagementPaymentStatus: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
    transfers: { create: vi.fn() },
  },
}));

import { releaseEngagementPayment } from "@/lib/settlement/payouts";

describe("releaseEngagementPayment", () => {
  beforeEach(() => {
    state.payment = null;
  });

  it("is not eligible when there is no matching payment", async () => {
    state.payment = null;
    await expect(releaseEngagementPayment("missing")).resolves.toBe(
      "not_eligible",
    );
  });

  it("allows releasing a period that is 'held' (the normal cron path)", async () => {
    state.payment = {
      id: "p-1",
      engagement_id: "e-1",
      status: "held",
      stripe_transfer_id: null,
      worker_amount: 100,
      platform_fee_kinglancer: 5,
      kinglancer_id: "kl-1",
    };
    const result = await releaseEngagementPayment("p-1");
    expect(result).not.toBe("not_eligible");
  });

  it("allows admin to release a 'disputed' period directly (matches pre-engine behaviour)", async () => {
    state.payment = {
      id: "p-2",
      engagement_id: "e-1",
      status: "disputed",
      stripe_transfer_id: null,
      worker_amount: 100,
      platform_fee_kinglancer: 5,
      kinglancer_id: "kl-1",
    };
    const result = await releaseEngagementPayment("p-2");
    expect(result).not.toBe("not_eligible");
  });

  it("rejects a period that is still 'due' or already 'refunded'", async () => {
    state.payment = { id: "p-3", status: "due", stripe_transfer_id: null };
    await expect(releaseEngagementPayment("p-3")).resolves.toBe(
      "not_eligible",
    );
    state.payment = { id: "p-4", status: "refunded", stripe_transfer_id: null };
    await expect(releaseEngagementPayment("p-4")).resolves.toBe(
      "not_eligible",
    );
  });
});
