import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { collectPages } from "@/lib/db/pagination";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * GET /api/cron/close-completed-roles
 *
 * Temporary organisation roles end on their advertised date. That date is the
 * natural end of the work — distinct from an early termination — so it closes
 * the engagement with termination_kind = 'completed'. Held money then releases
 * normally and earned periods are never silently cancelled, unlike an early
 * end which moves held payments into dispute.
 *
 * Runs daily. Idempotent: close_role_engagement only touches active roles and
 * re-sets ended_at/termination_kind on already-closed rows.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const query = db
    .from("jobs")
    .select("id")
    .eq("posting_type", "role")
    .eq("employment_type", "temporary")
    .not("ends_at", "is", null)
    .lte("ends_at", today)
    .order("id");
  const jobIds = await collectPages((from, to) => query.range(from, to));

  let closed = 0;
  const errors: string[] = [];
  for (const job of jobIds) {
    const { data: engagement } = await db
      .from("engagements")
      .select("id, status")
      .eq("source_kind", "org_role")
      .eq("source_id", job.id)
      .maybeSingle();
    if (!engagement || engagement.status !== "active") continue;
    const { error } = await db.rpc("close_role_engagement", {
      p_engagement_id: engagement.id,
      p_termination_kind: "completed",
    });
    if (error) {
      errors.push(`${engagement.id}: ${error.message ?? "could not close"}`);
      continue;
    }
    closed += 1;
  }

  return NextResponse.json({ ok: true, scanned: jobIds.length, closed, errors: errors.length ? errors : undefined });
}