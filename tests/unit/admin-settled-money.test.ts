import { describe, expect, it } from "vitest";
import {
  deriveAdminFinancials,
  type AdminTransaction,
  type StripeFunding,
} from "@/lib/admin-financials";
const job: AdminTransaction = {
  id: "job-payment",
  amount: 35,
  platform_fee_client: 0.88,
  platform_fee_kinglancer: 1.75,
  payment_method: "card",
  status: "held",
  manual_payout_reference: null,
  stripe_transfer_id: null,
  stripe_refund_id: null,
  release_outcome: null,
};
const receipt: StripeFunding = {
  paymentId: "job-payment",
  ledger: "transactions",
  netPence: 3468,
  status: "pending",
};
function money(
  available: number | null,
  rows: AdminTransaction[] = [job],
  funding: StripeFunding[] | null = [receipt],
) {
  return deriveAdminFinancials({
    transactions: rows,
    engagementPayments: [],
    stripeAvailablePence: available,
    stripeFunding: funding,
  })!;
}
describe("settled company money", () => {
  it("keeps the £257.73 company balance when a £35.88 client payment is pending", () => {
    expect(money(25773)).toMatchObject({
      estimatedWithdrawableGBP: 257.73,
      stripeOwedGBP: 33.25,
      deferredStripeFeesGBP: 2.63,
    });
  });
  it("does not change company money when the net held receipt settles", () => {
    expect(
      money(25773 + 3468, [job], [{ ...receipt, status: "available" }])
        .estimatedWithdrawableGBP,
    ).toBe(257.73);
  });
  it("adds only the net job fee after the worker is actually paid", () => {
    expect(
      money(
        25773 + 3468 - 3325,
        [{ ...job, status: "released", stripe_transfer_id: "tr_paid" }],
        [{ ...receipt, status: "available" }],
      ).estimatedWithdrawableGBP,
    ).toBe(259.16);
  });
  it("reserves the worker share after approval while leaving earned fees available", () => {
    expect(
      money(
        25773 + 3468,
        [{ ...job, status: "released" }],
        [{ ...receipt, status: "available" }],
      ).estimatedWithdrawableGBP,
    ).toBe(259.16);
  });
  it("reflects an owner withdrawal without pinning or hard-coding yesterday’s balance", () => {
    expect(money(25773 - 10000).estimatedWithdrawableGBP).toBe(157.73);
  });
  it("does not subtract bank-funded work from the Stripe pool", () => {
    expect(
      money(25773, [{ ...job, payment_method: "bank_transfer" }], [])
        .estimatedWithdrawableGBP,
    ).toBe(257.73);
  });
  it("does not report unverified positive money as available", () => {
    expect(money(25773, [job], []).estimatedWithdrawableGBP).toBeNull();
    expect(money(25773, [job], null).estimatedWithdrawableGBP).toBeNull();
    expect(money(null).estimatedWithdrawableGBP).toBeNull();
    expect(money(0, [job], null).estimatedWithdrawableGBP).toBe(0);
  });
  it("keeps refunds and uncertain transfers subject to verification", () => {
    expect(
      money(25773, [{ ...job, stripe_refund_id: "re_unknown" }])
        .estimatedWithdrawableGBP,
    ).toBeNull();
    expect(
      money(25773, [{ ...job, release_outcome: "dispatched" }])
        .estimatedWithdrawableGBP,
    ).toBeNull();
  });
  it("rejects invalid, duplicate or oversized receipt allocations", () => {
    expect(() =>
      money(25773, [job], [{ ...receipt, netPence: NaN }]),
    ).toThrow();
    expect(() => money(25773, [job], [receipt, receipt])).toThrow();
    expect(() =>
      money(25773, [job], [{ ...receipt, netPence: 3589 }]),
    ).toThrow();
  });
  it("handles held recurring payments and fee-only receipts consistently", () => {
    const summary = deriveAdminFinancials({
      transactions: [],
      engagementPayments: [
        {
          id: "period",
          worker_amount: 0,
          platform_fee_client: 2,
          platform_fee_kinglancer: 3,
          status: "held",
          stripe_transfer_id: null,
          stripe_refund_id: null,
          release_outcome: null,
        },
      ],
      stripeAvailablePence: 25773 + 450,
      stripeFunding: [
        {
          paymentId: "period",
          ledger: "engagement_payments",
          netPence: 450,
          status: "available",
        },
      ],
    });
    expect(summary?.estimatedWithdrawableGBP).toBe(257.73);
  });
});
