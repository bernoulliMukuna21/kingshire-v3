import { NextResponse } from "next/server";
import { processEngagementReleases } from "@/lib/settlement/payouts";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// GET /api/cron/release-engagements
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const result = await processEngagementReleases();
  return NextResponse.json({ ok: true, ...result });
}
