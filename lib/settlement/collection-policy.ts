/** Existing successful payments must still be reconciled when collection stops. */
export function canCollectEngagementPayment(
  engagement: { status: string; settlement_hold_at?: string | null } | null,
): boolean {
  return (
    !!engagement &&
    !engagement.settlement_hold_at &&
    ["active", "pending_funding"].includes(engagement.status)
  );
}
