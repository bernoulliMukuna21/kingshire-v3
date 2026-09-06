import { NextResponse } from "next/server";
import { listDuePlacementPayments } from "@/lib/db/placement-payments";
import { chargeDuePlacementPayment } from "@/lib/placement-billing";

export const dynamic = "force-dynamic";

// GET /api/cron/charge-placements
// Auto-charges the org's saved card for each managed placement month that is
// due. Secured via CRON_SECRET (same pattern as the other cron endpoints).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    // Dev only: allow unauthenticated access when the secret is not set.
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const due = await listDuePlacementPayments();
  const tally = { charged: 0, failed: 0, no_payment_method: 0 };

  for (const payment of due) {
    const result = await chargeDuePlacementPayment(payment);
    tally[result] += 1;
  }

  return NextResponse.json({ ok: true, processed: due.length, ...tally });
}
