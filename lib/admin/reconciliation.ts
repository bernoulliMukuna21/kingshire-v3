export type LedgerFunding = {
  id: string;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  status: string;
  expectedChargePence: number;
  expectedWorkerPence: number;
  manuallyPaid?: boolean;
};
export type StripeReceipt = {
  id: string;
  intentId: string | null;
  amount: number;
  refunded: number;
  paid: boolean;
};
export type StripeWorkerTransfer = {
  id: string;
  amount: number;
  reversed: boolean;
};

/** Receipt-level cross-checks: a recognised Stripe movement alone does not
 * establish that the database's worker liability or revenue is complete. */
export function reconcileAdminFunding(input: {
  ledger: LedgerFunding[];
  receipts: StripeReceipt[];
  transfers: StripeWorkerTransfer[];
  subscriptionIntentIds: string[];
}) {
  const issues: string[] = [];
  const differences: string[] = [];
  const receipts = new Map(
    input.receipts.filter((row) => row.paid).map((row) => [row.intentId, row]),
  );
  const transfers = new Map(input.transfers.map((row) => [row.id, row]));
  const knownIntents = new Set(input.subscriptionIntentIds);
  const knownTransfers = new Set<string>();
  for (const row of input.ledger) {
    if (
      !Number.isSafeInteger(row.expectedChargePence) ||
      !Number.isSafeInteger(row.expectedWorkerPence)
    )
      throw new Error("Invalid ledger money for reconciliation");
    if (!row.stripe_payment_intent_id) {
      issues.push(`Payment ${row.id} has no Stripe funding reference.`);
      continue;
    }
    if (knownIntents.has(row.stripe_payment_intent_id))
      issues.push(
        `Stripe funding is allocated more than once: ${row.stripe_payment_intent_id}.`,
      );
    knownIntents.add(row.stripe_payment_intent_id);
    const receipt = receipts.get(row.stripe_payment_intent_id);
    if (!receipt || receipt.amount !== row.expectedChargePence)
      issues.push(`Funding does not match payment ${row.id}.`);
    if (
      receipt &&
      ((receipt.refunded > 0 && row.status !== "refunded") ||
        (row.status === "refunded" && receipt.refunded !== receipt.amount))
    )
      issues.push(`Refund does not match payment ${row.id}.`);
    if (row.stripe_transfer_id) {
      if (knownTransfers.has(row.stripe_transfer_id))
        issues.push(
          `Worker transfer is allocated more than once: ${row.stripe_transfer_id}.`,
        );
      if (row.manuallyPaid)
        issues.push(
          `Both Stripe and manual payouts are recorded for payment ${row.id}.`,
        );
      knownTransfers.add(row.stripe_transfer_id);
      const transfer = transfers.get(row.stripe_transfer_id);
      if (!transfer || transfer.reversed)
        issues.push(
          `Worker transfer needs reconciliation for payment ${row.id}.`,
        );
      else if (transfer.amount !== row.expectedWorkerPence)
        differences.push(
          `Transfer ${transfer.id}: ${transfer.amount - row.expectedWorkerPence}p difference from recorded worker allocation.`,
        );
    }
  }
  for (const receipt of input.receipts.filter((row) => row.paid)) {
    if (!receipt.intentId || !knownIntents.has(receipt.intentId))
      issues.push(
        `Receipt ${receipt.id} has no matching payment or subscription.`,
      );
  }
  for (const transfer of input.transfers) {
    if (!knownTransfers.has(transfer.id))
      issues.push(`Transfer ${transfer.id} has no matching worker payment.`);
  }
  return { issues, differences };
}
