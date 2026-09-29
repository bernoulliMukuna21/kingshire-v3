/** Existing successful payments must still be reconciled when collection stops.
 *
 * A role that ended naturally (termination_kind = 'completed') is no longer
 * "active", but its earned periods — those whose due date has passed — still
 * need collecting. Work already done is not abandoned just because the term
 * ended on schedule, so collection stays open for those periods. Early
 * termination (and legacy rows with no termination_kind) keeps the old
 * behaviour: nothing more is collected. */
export function canCollectEngagementPayment(
  engagement: {
    status: string;
    settlement_hold_at?: string | null;
    termination_kind?: string | null;
  } | null,
): boolean {
  if (!engagement || engagement.settlement_hold_at) return false;
  if (["active", "pending_funding"].includes(engagement.status)) return true;
  return (
    engagement.status === "ended" &&
    engagement.termination_kind === "completed"
  );
}
