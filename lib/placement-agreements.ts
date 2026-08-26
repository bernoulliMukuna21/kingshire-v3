// Single source of truth for a placement AGREEMENT's lifecycle. UI reads the
// pills + capabilities from here, and API route guards derive from the same
// helpers, so what the UI offers and what the server allows can't drift.

export type AgreementStatus =
  | "pending_acceptance"
  | "active"
  | "completed"
  | "cancelled";

const AGREEMENT_PILLS: Record<string, { label: string; className: string }> = {
  pending_acceptance: {
    label: "Awaiting acceptance",
    className: "bg-amber-100 text-amber-700",
  },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Ended early", className: "bg-red-100 text-red-600" },
};

export function agreementStatusPill(status: string): {
  label: string;
  className: string;
} {
  return (
    AGREEMENT_PILLS[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-600",
    }
  );
}

const PAYMENT_PILLS: Record<string, { label: string; className: string }> = {
  due: { label: "Scheduled", className: "bg-slate-100 text-slate-600" },
  processing: { label: "Processing", className: "bg-amber-100 text-amber-700" },
  held: { label: "In escrow", className: "bg-blue-100 text-blue-700" },
  released: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Payment failed", className: "bg-red-100 text-red-600" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-500" },
};

export function placementPaymentPill(status: string): {
  label: string;
  className: string;
} {
  return (
    PAYMENT_PILLS[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-600",
    }
  );
}

export interface AgreementView {
  pill: { label: string; className: string };
  isPending: boolean;
  isActive: boolean;
  isManaged: boolean;
  /** Org can mark the placement complete (issues the verified record). */
  canComplete: boolean;
  /** Either party can propose ending early (subject to role checks in the UI). */
  canEndEarly: boolean;
  /** Check-ins can be posted. */
  canCheckIn: boolean;
}

/** Lifecycle view for a placement agreement — shared by UI and route guards. */
export function deriveAgreementView(agreement: {
  status: string;
  payment_mode?: string | null;
  monthly_amount?: number | null;
  end_requested_by?: string | null;
}): AgreementView {
  const isActive = agreement.status === "active";
  const isManaged =
    agreement.payment_mode === "managed" && !!agreement.monthly_amount;
  const hasEndRequest = !!agreement.end_requested_by;
  return {
    pill: agreementStatusPill(agreement.status),
    isPending: agreement.status === "pending_acceptance",
    isActive,
    isManaged,
    canComplete: isActive && !hasEndRequest,
    canEndEarly: isActive,
    canCheckIn: isActive,
  };
}
