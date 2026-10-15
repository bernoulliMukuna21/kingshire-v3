import { coerceNumeric } from "@/lib/db/coerce";
export type AdminHistoryInput = {
  id: string;
  status: string;
  created_at: string;
  gross: number | string;
  workerFee: number | string;
  title: string | null;
  workerName: string | null;
  fundingMethod: string;
  payoutMethod: string | null;
  ledger: "transactions" | "engagement_payments";
  periodIndex?: number;
  stripeTransferId?: string | null;
  manualPayoutReference?: string | null;
};
export function deriveAdminHistoryItem(input: AdminHistoryInput) {
  const row = coerceNumeric(input, ["gross", "workerFee"]);
  if (
    typeof row.gross !== "number" ||
    typeof row.workerFee !== "number" ||
    !Number.isFinite(row.gross) ||
    !Number.isFinite(row.workerFee) ||
    row.gross < 0 ||
    row.workerFee < 0 ||
    (row.gross > 0 && row.workerFee > row.gross)
  )
    throw new Error("Invalid history amount");
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    title:
      row.title ||
      (row.ledger === "transactions" ? "Job payment" : "Recurring payment"),
    worker: row.workerName || "Worker name not recorded",
    workerNetGBP:
      row.gross === 0
        ? 0
        : (Math.round(row.gross * 100) - Math.round(row.workerFee * 100)) / 100,
    funding:
      row.fundingMethod === "bank_transfer" ? "Bank transfer" : "Card payment",
    payout: row.stripeTransferId
      ? "Stripe payout"
      : row.manualPayoutReference || row.payoutMethod === "manual"
        ? "External payout"
        : row.payoutMethod === "stripe"
          ? "Stripe payout"
          : "Route not recorded",
    period: row.periodIndex ? `Period ${row.periodIndex}` : null,
    href: `/admin/finance/payments/${row.ledger}/${row.id}`,
    reference: row.id.slice(0, 8),
  };
}
