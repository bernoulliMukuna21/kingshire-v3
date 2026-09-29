/** Shared presentation for the offer summary and agreement page. */
export function deriveRoleOfferView(status: string) {
  const awaiting = status === "pending_acceptance";
  const label = ({
    pending_acceptance: "Awaiting response",
    pending_funding: "Accepted · awaiting funding",
    active: "Agreement active",
    ended: "Agreement ended",
    cancelled: "Offer closed",
  } as Record<string, string>)[status] ?? "Status unavailable";
  return {
    label,
    title: awaiting || status === "cancelled" ? "Offer" : "Agreement",
    recipientLabel: awaiting ? "Offer sent to" : status === "cancelled" ? "Offer to" : "Agreement with",
    canManage: ["pending_acceptance", "pending_funding", "active"].includes(status),
  };
}

export function rolePayLabel(amount: number | string | null, cadence: string) {
  const money = new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(Number(amount ?? 0)) ? 0 : 2,
  }).format(Number(amount ?? 0));
  return `${money} per ${cadence === "weekly" ? "week" : "month"}`;
}
