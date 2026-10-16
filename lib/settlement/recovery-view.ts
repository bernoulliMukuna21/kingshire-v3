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
  const recorded = !!row.stripe_transfer_id || !!row.stripe_refund_id;
  const notSent =
    row.release_outcome === "reserved" && !row.release_dispatch_started_at;
  const insufficient =
    row.release_outcome === "failed" &&
    row.release_failure_code === "balance_insufficient";
  const message = recorded
    ? {
        label: "Payment result needs saving",
        explanation:
          "A Stripe payment or refund reference is already recorded, but our records are not fully updated.",
        nextStep:
          "Ask support to confirm the result in Stripe and update this record before sending any money again.",
      }
    : insufficient
      ? {
          label: "Not enough money in Stripe",
          explanation:
            "Stripe did not send this payment because the available balance was too low.",
          nextStep:
            "Check the Stripe balance, then ask support to prepare this payment to be tried again.",
        }
      : notSent
        ? {
            label: "Payment has not been sent",
            explanation:
              "This payment was prepared, but the request has not been sent to Stripe.",
            nextStep:
              "Ask support to check why it stopped and prepare it to be tried again.",
          }
        : {
            label: "Check whether the payment went through",
            explanation:
              "We have not confirmed the final result from Stripe. The money may already have been sent.",
            nextStep:
              "Ask support to check Stripe before trying again, so nobody is paid twice.",
          };
  return {
    ...message,

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
  };
}
