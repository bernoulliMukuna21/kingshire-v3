import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientSubscriptionRow } from "@/lib/db/client-subscriptions";

const getClientSubscriptionRow = vi.fn();
vi.mock("@/lib/db/client-subscriptions", () => ({
  getClientSubscriptionRow: (userId: string) =>
    getClientSubscriptionRow(userId),
}));

import {
  hasActiveClientSubscription,
  jobCardPaymentAllowed,
} from "@/lib/client-subscription";

function row(status: string): ClientSubscriptionRow {
  return {
    user_id: "u1",
    status,
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    stripe_price_id: "price_1",
    cancel_at_period_end: false,
    current_period_end: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

beforeEach(() => getClientSubscriptionRow.mockReset());

describe("hasActiveClientSubscription", () => {
  it("is true for an active subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(row("active"));
    expect(await hasActiveClientSubscription("u1")).toBe(true);
  });

  it("is true for a trialing subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(row("trialing"));
    expect(await hasActiveClientSubscription("u1")).toBe(true);
  });

  it("is false for a cancelled or past_due subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(row("canceled"));
    expect(await hasActiveClientSubscription("u1")).toBe(false);
    getClientSubscriptionRow.mockResolvedValue(row("past_due"));
    expect(await hasActiveClientSubscription("u1")).toBe(false);
  });

  it("is false when there is no subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(null);
    expect(await hasActiveClientSubscription("u1")).toBe(false);
  });
});

describe("jobCardPaymentAllowed", () => {
  it("allows card for organisation jobs without a client subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(null);
    expect(
      await jobCardPaymentAllowed({
        organisation_id: "org1",
        client_id: "u1",
      }),
    ).toBe(true);
  });

  it("blocks card for personal jobs without an active subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(null);
    expect(
      await jobCardPaymentAllowed({ organisation_id: null, client_id: "u1" }),
    ).toBe(false);
  });

  it("allows card for personal jobs with an active subscription", async () => {
    getClientSubscriptionRow.mockResolvedValue(row("active"));
    expect(
      await jobCardPaymentAllowed({ organisation_id: null, client_id: "u1" }),
    ).toBe(true);
  });
});
