import { NextResponse } from "next/server";
import { processPlacementReleases } from "@/lib/placement-payouts";

export const dynamic = "force-dynamic";

// GET /api/cron/release-placements
// Sends the month-end release notice and releases held escrow to Kinglancers
// once each month is over (unless disputed). Secured via CRON_SECRET.
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

  const result = await processPlacementReleases();
  return NextResponse.json({ ok: true, ...result });
}
