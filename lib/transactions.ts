export type TransactionStatusPill = { label: string; className: string };

// Single source of truth for a job escrow transaction status → pill.
const TRANSACTION_PILLS: Record<string, TransactionStatusPill> = {
  pending: { label: "Awaiting payment", className: "bg-slate-100 text-slate-600" },
  held: { label: "In escrow", className: "bg-blue-50 text-blue-700" },
  released: { label: "Released", className: "bg-green-50 text-green-700" },
  refunded: { label: "Refunded", className: "bg-orange-50 text-orange-700" },
  disputed: { label: "Disputed", className: "bg-red-50 text-red-700" },
};

export function transactionStatusPill(status: string): TransactionStatusPill {
  return (
    TRANSACTION_PILLS[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-600",
    }
  );
}
