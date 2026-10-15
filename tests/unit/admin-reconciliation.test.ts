import { describe, it, expect } from "vitest";
import {
  reconcileAdminFunding,
  type LedgerFunding,
} from "@/lib/admin/reconciliation";
const ledger: LedgerFunding = {
  id: "payment",
  stripe_payment_intent_id: "pi_work",
  stripe_transfer_id: "tr_worker",
  status: "released",
  expectedChargePence: 10250,
  expectedWorkerPence: 9500,
};
const input = () => ({
  ledger: [ledger],
  receipts: [
    {
      id: "ch_work",
      intentId: "pi_work",
      amount: 10250,
      refunded: 0,
      paid: true,
    },
  ],
  transfers: [{ id: "tr_worker", amount: 9500, reversed: false }],
  subscriptionIntentIds: [] as string[],
});
describe("admin receipt reconciliation", () => {
  it("matches customer funding and completed worker transfers", () =>
    expect(reconcileAdminFunding(input())).toEqual({
      issues: [],
      differences: [],
    }));
  it("accepts independently identified subscription receipts", () => {
    const data = input();
    data.receipts.push({
      id: "ch_sub",
      intentId: "pi_sub",
      amount: 500,
      refunded: 0,
      paid: true,
    });
    data.subscriptionIntentIds = ["pi_sub"];
    expect(reconcileAdminFunding(data).issues).toEqual([]);
  });
  it("withholds earnings for orphan receipts rather than counting them as revenue", () => {
    const data = input();
    data.receipts.push({
      id: "orphan",
      intentId: "pi_orphan",
      amount: 500,
      refunded: 0,
      paid: true,
    });
    expect(reconcileAdminFunding(data).issues[0]).toContain(
      "no matching payment",
    );
  });
  it("detects missing funding, reused funding and reversed transfers", () => {
    const data = input();
    data.ledger.push({ ...ledger, id: "other" });
    data.transfers[0].reversed = true;
    expect(reconcileAdminFunding(data).issues).toHaveLength(4);
  });
  it("flags a payment recorded as paid through both payout routes", () => {
    const data = input();
    data.ledger[0] = { ...ledger, manuallyPaid: true };
    expect(reconcileAdminFunding(data).issues[0]).toContain(
      "Both Stripe and manual",
    );
  });
  it("reports transfer allocation variance without subtracting it from cash twice", () => {
    const data = input();
    data.transfers[0].amount += 91;
    const result = reconcileAdminFunding(data);
    expect(result.issues).toEqual([]);
    expect(result.differences[0]).toContain("91p");
  });
  it("detects funding amount or refund state mismatches", () => {
    const data = input();
    data.receipts[0].amount = 10000;
    data.receipts[0].refunded = 100;
    expect(reconcileAdminFunding(data).issues).toHaveLength(2);
  });
  it("does not treat an unsuccessful charge as funding", () => {
    const data = input();
    data.receipts[0].paid = false;
    expect(reconcileAdminFunding(data).issues[0]).toContain(
      "Funding does not match",
    );
  });
  it("detects unallocated actual transfers", () => {
    const data = input();
    data.transfers.push({ id: "tr_extra", amount: 100, reversed: false });
    expect(reconcileAdminFunding(data).issues[0]).toContain(
      "no matching worker payment",
    );
  });
});
