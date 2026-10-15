import { describe, it, expect } from "vitest";
import {
  deriveAdminHistoryItem,
  type AdminHistoryInput,
} from "@/lib/admin/payment-history-view";
const payment: AdminHistoryInput = {
  id: "abcdefgh-payment",
  status: "held",
  created_at: "2026-10-15",
  gross: "45.00",
  workerFee: "2.25",
  title: "Cleaning Assistant",
  workerName: "Powell Longjohn",
  fundingMethod: "card",
  payoutMethod: "manual",
  ledger: "transactions",
};
describe("admin payment history", () => {
  it("leads with work and recipient context and normalises money once", () =>
    expect(deriveAdminHistoryItem(payment)).toMatchObject({
      title: "Cleaning Assistant",
      worker: "Powell Longjohn",
      workerNetGBP: 42.75,
      funding: "Card payment",
      payout: "External payout",
      reference: "abcdefgh",
    }));
  it("keeps recurring fee-only payments at zero worker net", () =>
    expect(
      deriveAdminHistoryItem({
        ...payment,
        ledger: "engagement_payments",
        gross: "0",
        workerFee: "5",
        periodIndex: 2,
      }),
    ).toMatchObject({ workerNetGBP: 0, period: "Period 2" }));
  it("sums in pence for fractional decimal values", () =>
    expect(
      deriveAdminHistoryItem({ ...payment, gross: 0.3, workerFee: 0.1 })
        .workerNetGBP,
    ).toBe(0.2));
  it("uses a useful fallback rather than an ID as the main title", () =>
    expect(
      deriveAdminHistoryItem({ ...payment, title: null, workerName: null }),
    ).toMatchObject({
      title: "Job payment",
      worker: "Worker name not recorded",
    }));
  it.each([
    { gross: "invalid" },
    { gross: -1 },
    { workerFee: 100 },
    { workerFee: "" },
  ])("does not disguise invalid money as zero: %j", (patch) =>
    expect(() => deriveAdminHistoryItem({ ...payment, ...patch })).toThrow(),
  );
});

describe("historical payout evidence", () => {
  it("recognises a completed Stripe transfer even without the legacy payout-method flag", () => {
    expect(
      deriveAdminHistoryItem({
        ...payment,
        payoutMethod: null,
        stripeTransferId: "tr_paid",
      }).payout,
    ).toBe("Stripe payout");
  });
  it("recognises an external payout reference without inventing a pending payment", () => {
    expect(
      deriveAdminHistoryItem({
        ...payment,
        payoutMethod: null,
        manualPayoutReference: "bank_reference",
      }).payout,
    ).toBe("External payout");
  });
});
