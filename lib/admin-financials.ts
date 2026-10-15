import { coerceNumericList } from "@/lib/db/coerce";

type Settlement = {
  status: string;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  release_outcome: string | null;
};

export type AdminTransaction = Settlement & {
  amount: number | string;
  platform_fee_client: number | string;
  platform_fee_kinglancer: number | string;
  payment_method: string;
  manual_payout_reference: string | null;
};

export type AdminEngagementPayment = Settlement & {
  worker_amount: number | string;
  platform_fee_client: number | string;
  platform_fee_kinglancer: number | string;
};

function pence(value: number | string): number {
  // The read boundary below coerces numeric strings. Invalid money must never
  // turn into a zero liability or an apparently available withdrawal.
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("Invalid financial amount");
  return Math.round(value * 100);
}

function unsettled(payment: Settlement): boolean {
  return ["held", "released", "disputed"].includes(payment.status) &&
    !payment.stripe_transfer_id;
}

/** Complete ledger reads only. Worker liabilities, earnings and cash are distinct. */
export function deriveAdminFinancials(input: {
  transactions: AdminTransaction[] | null;
  engagementPayments: AdminEngagementPayment[] | null;
  stripeAvailablePence: number | null;
  stripeActivity?: StripeActivity | null;
}) {
  if (input.transactions === null || input.engagementPayments === null) return null;
  const transactions = coerceNumericList(input.transactions, [
    "amount", "platform_fee_client", "platform_fee_kinglancer",
  ]);
  const engagements = coerceNumericList(input.engagementPayments, [
    "worker_amount", "platform_fee_client", "platform_fee_kinglancer",
  ]);
  let stripeOwed = 0;
  let bankOwed = 0;
  let processed = 0;
  let fees = 0;
  let manualCardPaid = 0;
  let deferredStripeFees = 0;
  let bankFees = 0;
  for (const row of transactions) {
    const gross = pence(row.amount);
    const clientFee = pence(row.platform_fee_client);
    const workerFee = pence(row.platform_fee_kinglancer);
    if (workerFee > gross) throw new Error("Worker fee exceeds payment");
    if (row.status === "released") {
      processed += gross + clientFee;
      fees += clientFee + workerFee;
      if (row.payment_method === "bank_transfer") bankFees += clientFee + workerFee;
    }
    if (row.payment_method === "card" && row.manual_payout_reference)
      manualCardPaid += gross - workerFee;
    if (row.payment_method === "card" && ["held", "disputed"].includes(row.status) && !row.stripe_transfer_id && !row.manual_payout_reference)
      deferredStripeFees += clientFee + workerFee;
    if (!unsettled(row) || row.manual_payout_reference) continue;
    if (row.payment_method === "bank_transfer") bankOwed += gross - workerFee;
    else if (row.payment_method === "card") stripeOwed += gross - workerFee;
    else throw new Error("Unknown funding method");
  }
  for (const row of engagements) {
    const gross = pence(row.worker_amount);
    const workerFee = pence(row.platform_fee_kinglancer);
    const clientFee = pence(row.platform_fee_client);
    // Direct engagements collect fees only, with no platform worker liability.
    if (["held", "disputed"].includes(row.status) && !row.stripe_transfer_id)
      deferredStripeFees += clientFee + workerFee;
    if (gross === 0) continue;
    if (workerFee > gross) throw new Error("Worker fee exceeds payment");
    if (unsettled(row)) stripeOwed += gross - workerFee;
  }
  const needsReconciliation = [...transactions, ...engagements].some(row =>
    ["reserved", "dispatched", "confirmed", "pending"].includes(row.release_outcome ?? "") ||
    (!!row.stripe_refund_id && row.status !== "refunded"),
  );
  const activity = input.stripeActivity;
  const reconciliation = needsReconciliation || !!activity?.needsReconciliation;
  const available = input.stripeAvailablePence;
  if (available !== null && !Number.isSafeInteger(available))
    throw new Error("Invalid Stripe balance");
  return {
    owedGBP: (stripeOwed + bankOwed) / 100,
    stripeOwedGBP: stripeOwed / 100,
    bankOwedGBP: bankOwed / 100,
    // Paid workers are expenses, not outstanding liabilities. Do not invent a
    // reimbursement obligation from historical manual payout references. Bank
    // obligations belong to the bank pool; reserve full held Stripe payments.
    // A confirmed non-positive balance has no withdrawable cash even when
    // history needs matching. Unverified positive balances stay unavailable.
    estimatedWithdrawableGBP: available === null ? null : available <= 0 ? 0
      : input.stripeActivity === null || reconciliation ? null
      : Math.max(0, available - stripeOwed - deferredStripeFees) / 100,
    stripeNetProceedsGBP: !activity || reconciliation ? null
      : (activity.operatingNetPence - manualCardPaid - stripeOwed - deferredStripeFees) / 100,
    platformNetProceedsGBP: !activity || reconciliation ? null
      : (activity.operatingNetPence - manualCardPaid - stripeOwed - deferredStripeFees + bankFees) / 100,
    bankFeesGBP: bankFees / 100,
    manualCardPaidGBP: manualCardPaid / 100,
    deferredStripeFeesGBP: deferredStripeFees / 100,
    stripeCostsGBP: activity ? activity.costsPence / 100 : null,
    needsReconciliation: reconciliation,
    // Preserve the existing one-off released-payment scope of these counters.
    totalProcessedGBP: processed / 100,
    platformFeesGBP: fees / 100,
  };
}


export type StripeMovement = {
  currency: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
};

export type StripeActivity = {
  operatingNetPence: number;
  costsPence: number;
  customerReceiptsPence: number;
  topupsPence: number;
  withdrawalsPence: number;
  needsReconciliation: boolean;
};

/** Stripe balance movements are already integer minor units. Transfers are
 * worker costs; top-ups and bank withdrawals are financing, never revenue. */
export function deriveStripeActivity(rows: StripeMovement[]): StripeActivity {
  const result: StripeActivity = {
    operatingNetPence: 0, costsPence: 0, customerReceiptsPence: 0,
    topupsPence: 0, withdrawalsPence: 0, needsReconciliation: false,
  };
  for (const row of rows) {
    if (row.currency !== "gbp") { result.needsReconciliation = true; continue; }
    if (![row.amount, row.fee, row.net].every(Number.isSafeInteger) || row.net !== row.amount - row.fee)
      throw new Error("Invalid Stripe balance movement");
    result.costsPence += row.fee;
    switch (row.type) {
      case "topup": case "topup_reversal":
        result.topupsPence += row.amount;
        result.operatingNetPence -= row.fee;
        break;
      case "payout": case "payout_cancel": case "payout_failure":
        result.withdrawalsPence -= row.amount;
        result.operatingNetPence -= row.fee;
        break;
      case "charge": case "payment":
        result.customerReceiptsPence += row.amount;
        result.operatingNetPence += row.net;
        break;
      case "stripe_fee": case "stripe_fx_fee":
        result.costsPence -= row.amount;
        result.operatingNetPence += row.net;
        break;
      case "transfer": case "transfer_refund": case "refund": case "payment_refund":
      case "refund_failure": case "payment_failure_refund":
        result.operatingNetPence += row.net;
        break;
      default:
        // Adjustments/disputes/reserves need classification before claiming earnings.
        result.needsReconciliation = true;
    }
  }
  return result;
}
