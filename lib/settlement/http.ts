import { NextResponse } from "next/server";
import type { EngagementPayoutResult } from "./payouts";

export function settlementResponse(
  result: EngagementPayoutResult | "refunded",
) {
  if (
    result === "released" ||
    result === "already_transferred" ||
    result === "refunded"
  ) {
    return NextResponse.json({ ok: true, result });
  }
  return NextResponse.json(
    {
      ok: false,
      result,
      error:
        result === "pending_onboarding"
          ? "The Kinglancer must complete payout onboarding before release."
          : "Payment was not released. Check its status and any pending reconciliation.",
    },
    { status: 409 },
  );
}
