import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  payment: null as Record<string, unknown> | null,
  profile: null as Record<string, unknown> | null,
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
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: state.profile, error: null }),
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
  updateEngagementPaymentStatusIf: vi.fn().mockResolvedValue({ id: "settled" }),
  recordEngagementTransfer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
    transfers: { create: vi.fn().mockResolvedValue({ id: "tr_123" }) },
  },
}));

import { releaseEngagementPayment } from "@/lib/settlement/payouts";
import {
  updateEngagementPaymentStatusIf,
  recordEngagementTransfer,
} from "@/lib/db/engagement-payments";

describe("releaseEngagementPayment", () => {
  beforeEach(() => {
    state.payment = null;
    state.profile = null;
    vi.clearAllMocks();
    vi.mocked(updateEngagementPaymentStatusIf).mockResolvedValue({
      id: "settled",
    } as never);
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

  it("fires the transfer then CAS-writes 'released', guarded against a concurrent status change", async () => {
    state.payment = {
      id: "p-5",
      engagement_id: "e-1",
      status: "held",
      stripe_transfer_id: null,
      worker_amount: 100,
      platform_fee_kinglancer: 5,
      kinglancer_id: "kl-1",
    };
    state.profile = {
      stripe_account_id: "acct_1",
      stripe_onboarding_complete: true,
    };
    const result = await releaseEngagementPayment("p-5");
    expect(result).toBe("released");
    expect(updateEngagementPaymentStatusIf).toHaveBeenCalledWith(
      "p-5",
      ["held", "disputed"],
      "released",
      expect.objectContaining({ stripe_transfer_id: "tr_123" }),
    );
    expect(recordEngagementTransfer).not.toHaveBeenCalled();
  });

  it("still records a succeeded transfer even if something else won the status race", async () => {
    vi.mocked(updateEngagementPaymentStatusIf).mockResolvedValueOnce(null);
    state.payment = {
      id: "p-6",
      engagement_id: "e-1",
      status: "held",
      stripe_transfer_id: null,
      worker_amount: 100,
      platform_fee_kinglancer: 5,
      kinglancer_id: "kl-1",
    };
    state.profile = {
      stripe_account_id: "acct_1",
      stripe_onboarding_complete: true,
    };
    const result = await releaseEngagementPayment("p-6");
    expect(result).toBe("released");
    expect(recordEngagementTransfer).toHaveBeenCalledWith(
      "p-6",
      expect.objectContaining({ stripe_transfer_id: "tr_123" }),
    );
  });
});

