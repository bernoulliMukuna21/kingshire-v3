export type RecoveryState = {
  release_attempt_id: string | null;
  release_outcome: string | null;
  release_dispatch_started_at: string | null;
  release_failure_code: string | null;
  release_idempotency_key: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
};

export function deriveRecoveryView(row: RecoveryState, now = Date.now()) {
  const age = row.release_dispatch_started_at
    ? now - new Date(row.release_dispatch_started_at).getTime()
    : Infinity;
  return {
    canReset:
      !!row.release_attempt_id &&
      !row.stripe_transfer_id &&
      !row.stripe_refund_id &&
      ((row.release_outcome === "reserved" &&
        !row.release_dispatch_started_at) ||
        (row.release_outcome === "failed" &&
          row.release_failure_code === "balance_insufficient")),
    canRetry:
      !!row.release_attempt_id &&
      !!row.release_idempotency_key &&
      ["dispatched", "confirmed", "pending"].includes(
        row.release_outcome ?? "",
      ) &&
      age >= 0 &&
      age < 20 * 60 * 60 * 1000,
    label:
      row.release_outcome === "reserved"
        ? "Prepared, not sent"
        : row.release_outcome === "failed"
          ? "Stripe rejected the request"
          : "Outcome needs verification",
  };
}
