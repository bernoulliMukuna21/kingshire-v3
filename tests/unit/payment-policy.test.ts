import { describe, it, expect, vi, beforeEach } from "vitest";

const isSubscribed = vi.fn();
vi.mock("@/lib/subscriptions", () => ({
  isSubscribed: (userId: string, role: string) => isSubscribed(userId, role),
}));

import {
  resolveCardPolicy,
  getJobPaymentPolicy,
  CARD_MIN_WITHOUT_SUB_GBP,
} from "@/lib/payments/policy";

describe("resolveCardPolicy", () => {
  it("allows card for organisation jobs of any size", () => {
    const policy = resolveCardPolicy({
      organisationId: "org1",
      budget: 5,
      clientSubscribed: false,
    });
    expect(policy.cardAllowed).toBe(true);
    expect(policy.requiresSubscription).toBe(false);
  });

  it("blocks card for a small personal job without a subscription", () => {
    const policy = resolveCardPolicy({
      organisationId: null,
      budget: CARD_MIN_WITHOUT_SUB_GBP - 1,
      clientSubscribed: false,
    });
    expect(policy.cardAllowed).toBe(false);
    expect(policy.requiresSubscription).toBe(true);
    expect(policy.bankTransferAllowed).toBe(true);
  });

  it("allows card for a small personal job with a subscription", () => {
    const policy = resolveCardPolicy({
      organisationId: null,
      budget: CARD_MIN_WITHOUT_SUB_GBP - 1,
      clientSubscribed: true,
    });
    expect(policy.cardAllowed).toBe(true);
    expect(policy.requiresSubscription).toBe(false);
  });

  it("allows card at/above the threshold without a subscription", () => {
    const policy = resolveCardPolicy({
      organisationId: null,
      budget: CARD_MIN_WITHOUT_SUB_GBP,
      clientSubscribed: false,
    });
    expect(policy.cardAllowed).toBe(true);
    expect(policy.requiresSubscription).toBe(false);
  });
});

describe("getJobPaymentPolicy", () => {
  beforeEach(() => isSubscribed.mockReset());

  it("does not check subscription for org jobs", async () => {
    const policy = await getJobPaymentPolicy({
      organisation_id: "org1",
      client_id: "u1",
      budget: 10,
    });
    expect(policy.cardAllowed).toBe(true);
    expect(isSubscribed).not.toHaveBeenCalled();
  });

  it("blocks a small personal card job when the client isn't subscribed", async () => {
    isSubscribed.mockResolvedValue(false);
    const policy = await getJobPaymentPolicy({
      organisation_id: null,
      client_id: "u1",
      budget: CARD_MIN_WITHOUT_SUB_GBP - 5,
    });
    expect(policy.cardAllowed).toBe(false);
    expect(isSubscribed).toHaveBeenCalledWith("u1", "client");
  });

  it("allows a small personal card job when the client is subscribed", async () => {
    isSubscribed.mockResolvedValue(true);
    const policy = await getJobPaymentPolicy({
      organisation_id: null,
      client_id: "u1",
      budget: CARD_MIN_WITHOUT_SUB_GBP - 5,
    });
    expect(policy.cardAllowed).toBe(true);
  });
});
