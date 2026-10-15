import { describe, expect, it } from "vitest";
import { deriveAdminFinancials, deriveStripeActivity, type AdminTransaction, type AdminEngagementPayment } from "@/lib/admin-financials";

const transaction = (patch: Partial<AdminTransaction> = {}): AdminTransaction => ({
  amount: 100, platform_fee_client: 2.5, platform_fee_kinglancer: 5,
  status: "held", payment_method: "card", manual_payout_reference: null,
  stripe_transfer_id: null, stripe_refund_id: null, release_outcome: null, ...patch,
});
const engagement = (patch: Partial<AdminEngagementPayment> = {}): AdminEngagementPayment => ({
  worker_amount: 100, platform_fee_client: 2.5, platform_fee_kinglancer: 5, status: "held",
  stripe_transfer_id: null, stripe_refund_id: null, release_outcome: null, ...patch,
});
const derive = (transactions: AdminTransaction[], engagementPayments: AdminEngagementPayment[] = []) =>
  deriveAdminFinancials({ transactions, engagementPayments, stripeAvailablePence: 23574 })!;

describe("admin financials", () => {
  it("reconciles the £248.90 incident: £206.15 already paid, £42.75 still held", () => {
    const paidGross = [35, 35, 30, 30, 32, 25, 30];
    const rows = paidGross.map(amount => transaction({ amount, platform_fee_kinglancer: amount * .05,
      status: "released", manual_payout_reference: "paid" }));
    rows.push(transaction({ amount: "45", platform_fee_client: "1.13",
      platform_fee_kinglancer: "2.25", payment_method: "bank_transfer" }));
    expect(derive(rows)).toMatchObject({ owedGBP: 42.75, stripeOwedGBP: 0,
      bankOwedGBP: 42.75, estimatedWithdrawableGBP: 235.74 });
  });

  it("excludes completed transfers, manual payouts and refunds", () => {
    expect(derive([
      transaction({ status: "released", stripe_transfer_id: "tr_paid" }),
      transaction({ status: "released", manual_payout_reference: "bank-paid" }),
      transaction({ status: "refunded" }), transaction({ status: "cancelled" }),
      // Stripe succeeded but the DB status write has not caught up.
      transaction({ stripe_transfer_id: "tr_paid" }),
    ]).owedGBP).toBe(0);
  });

  it("keeps unpaid released, disputed and manual-queued card funds reserved", () => {
    expect(derive([transaction(), transaction({ status: "released" }),
      transaction({ status: "disputed" })])).toMatchObject({
      owedGBP: 285, stripeOwedGBP: 285, estimatedWithdrawableGBP: 0,
    });
  });

  it("includes funded recurring obligations but excludes future, direct and settled periods", () => {
    expect(derive([], [engagement(), engagement({ status: "disputed" }),
      engagement({ status: "due" }), engagement({ status: "processing" }),
      engagement({ status: "failed" }), engagement({ status: "refunded" }),
      engagement({ status: "released", stripe_transfer_id: "tr_paid" }),
      engagement({ status: "released", worker_amount: 0 }),
    ])).toMatchObject({ owedGBP: 190, stripeOwedGBP: 190, estimatedWithdrawableGBP: 30.74 });
  });

  it("normalises string money and sums in pence", () => {
    const row = transaction({ amount: "100.00", platform_fee_client: "2.50",
      platform_fee_kinglancer: "5.00", status: "released" });
    expect(derive([row, row])).toMatchObject({ owedGBP: 190, totalProcessedGBP: 205, platformFeesGBP: 15 });
    expect(derive([transaction({ amount: .3, platform_fee_client: 0, platform_fee_kinglancer: .1 })]).owedGBP).toBe(.2);
  });

  it("does not interpret a failed ledger or balance read as zero", () => {
    expect(deriveAdminFinancials({ transactions: null, engagementPayments: [], stripeAvailablePence: 23574 })).toBeNull();
    expect(deriveAdminFinancials({ transactions: [], engagementPayments: null, stripeAvailablePence: 23574 })).toBeNull();
    expect(deriveAdminFinancials({ transactions: [], engagementPayments: [], stripeAvailablePence: null })?.estimatedWithdrawableGBP).toBeNull();
    expect(derive([]).estimatedWithdrawableGBP).toBe(235.74);
  });

  it.each(["reserved", "dispatched", "confirmed", "pending"])("withholds withdrawal estimates for %s settlements", release_outcome => {
    expect(derive([transaction({ release_outcome })])).toMatchObject({
      needsReconciliation: true, estimatedWithdrawableGBP: null,
    });
  });

  it("reserves pending refunds until reconciliation", () => {
    expect(derive([transaction({ stripe_refund_id: "re_pending" })])).toMatchObject({
      owedGBP: 95, estimatedWithdrawableGBP: null,
    });
  });

  it("rejects invalid money instead of understating liabilities", () => {
    expect(() => derive([transaction({ amount: "invalid" })])).toThrow();
    expect(() => derive([transaction({ amount: "" })])).toThrow();
    expect(() => derive([transaction({ amount: -1 })])).toThrow();
    expect(() => derive([transaction({ platform_fee_kinglancer: 101 })])).toThrow();
    expect(() => derive([transaction({ payment_method: "unknown" })])).toThrow();
  });
});


describe("Stripe platform proceeds", () => {
  const movement = (type: string, amount: number, fee = 0) => ({
    type, amount, fee, net: amount - fee, currency: "gbp",
  });
  it("separates earnings from owner funding and withdrawals, including their fees", () => {
    const activity = deriveStripeActivity([
      movement("charge", 10250, 200), movement("transfer", -9500),
      movement("charge", 500, 28), movement("stripe_fee", -50),
      movement("topup", 10000), movement("payout", -3000, 25),
    ]);
    expect(activity).toMatchObject({ operatingNetPence: 947, costsPence: 303,
      customerReceiptsPence: 10750, topupsPence: 10000, withdrawalsPence: 3000 });
    expect(deriveAdminFinancials({transactions: [transaction({status: "released", stripe_transfer_id: "tr_paid"})],
      engagementPayments: [], stripeAvailablePence: 5000, stripeActivity: activity,
    })?.stripeNetProceedsGBP).toBe(9.47);
  });
  it("reserves the full held client payment without reserving historical paid workers again", () => {
    const stripeActivity = deriveStripeActivity([movement("charge", 10250, 200), movement("charge", 10250, 200)]);
    const result = deriveAdminFinancials({ transactions: [transaction(), transaction({status:"released",manual_payout_reference:"bank-paid"})],
      engagementPayments: [], stripeAvailablePence: 20100, stripeActivity });
    expect(result).toMatchObject({ owedGBP:95, stripeNetProceedsGBP:3.5,
      manualCardPaidGBP:95, deferredStripeFeesGBP:7.5, estimatedWithdrawableGBP:98.5 });
  });
  it("keeps bank obligations outside Stripe cash and includes released bank fees separately", () => {
    expect(derive([transaction({payment_method:"bank_transfer"}), transaction({payment_method:"bank_transfer",status:"released",manual_payout_reference:"paid"})]))
      .toMatchObject({owedGBP:95,bankOwedGBP:95,bankFeesGBP:7.5,estimatedWithdrawableGBP:235.74});
  });
  it("does not lose refund costs or treat reversed withdrawals as income", () => {
    expect(deriveStripeActivity([movement("charge",10250,200),movement("refund",-10250),
      movement("payout",-1000),movement("payout_failure",1000)]).operatingNetPence).toBe(-200);
  });
  it("withholds earnings on unknown movements, currencies or missing Stripe activity", () => {
    const activity = deriveStripeActivity([movement("adjustment",100)]);
    expect(activity.needsReconciliation).toBe(true);
    expect(deriveStripeActivity([{...movement("charge",100),currency:"usd"}]).needsReconciliation).toBe(true);
    const input = {transactions:[],engagementPayments:[],stripeAvailablePence:10000};
    expect(deriveAdminFinancials({...input,stripeActivity:activity})).toMatchObject({stripeNetProceedsGBP:null,estimatedWithdrawableGBP:null});
    expect(deriveAdminFinancials({...input,stripeActivity:null})).toMatchObject({stripeNetProceedsGBP:null,estimatedWithdrawableGBP:null});
    expect(()=>deriveStripeActivity([{...movement("charge",100),net:99}])).toThrow();
  });
});


describe("gross job revenue versus net Stripe proceeds", () => {
  it("keeps recorded job fees visible before costs and does not include worker principal", () => {
    const stripeActivity = deriveStripeActivity([
      {type:"charge",currency:"gbp",amount:10250,fee:200,net:10050},
      {type:"transfer",currency:"gbp",amount:-9500,fee:0,net:-9500},
    ]);
    expect(deriveAdminFinancials({transactions:[transaction({status:"released",stripe_transfer_id:"tr_paid"})],
      engagementPayments:[],stripeAvailablePence:550,stripeActivity})).toMatchObject({
      platformFeesGBP:7.5,stripeNetProceedsGBP:5.5,stripeCostsGBP:2,owedGBP:0,
    });
  });
  it("a completed manual payout does not become a second cash liability", () => {
    expect(derive([transaction({status:"released",manual_payout_reference:"paid"})]))
      .toMatchObject({owedGBP:0,stripeOwedGBP:0,estimatedWithdrawableGBP:235.74});
  });
});


describe("total platform earnings and invalidated bank funding", () => {
  it("adds recorded bank fees to net Stripe proceeds without treating revenue as profit", () => {
    const stripeActivity = deriveStripeActivity([
      {type:"charge",currency:"gbp",amount:10250,fee:200,net:10050},
      {type:"transfer",currency:"gbp",amount:-9500,fee:0,net:-9500},
    ]);
    expect(deriveAdminFinancials({transactions:[
      transaction({status:"released",stripe_transfer_id:"tr_paid"}),
      transaction({status:"released",payment_method:"bank_transfer",manual_payout_reference:"paid"}),
    ],engagementPayments:[],stripeAvailablePence:550,stripeActivity})).toMatchObject({
      platformFeesGBP:15,stripeNetProceedsGBP:5.5,platformNetProceedsGBP:13,owedGBP:0,
    });
  });
  it("an invalidated bank confirmation does not count as funding, revenue or worker debt", () => {
    expect(derive([transaction({status:"pending",payment_method:"bank_transfer",amount:45,
      platform_fee_client:1.13,platform_fee_kinglancer:2.25})])).toMatchObject({
      owedGBP:0,bankOwedGBP:0,platformFeesGBP:0,bankFeesGBP:0,
    });
  });
});
