import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/expire-jobs
 *
 * Finds all open jobs whose deadline has passed, cancels them, bulk-rejects
 * any pending applications, and notifies both clients and applicants.
 *
 * Designed to run once daily (e.g. 00:05 UTC). Fully idempotent — running
 * multiple times is safe because every operation is guarded by the current
 * status value.
 *
 * Railway cron service start command:
 *   node scripts/run-cron.mjs /api/cron/expire-jobs
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[expire-jobs] CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    // Dev: allow unauthenticated when secret is not configured
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const db = createServiceClient();

  // Compare against today's date only (no time component) so a job with
  // deadline = today is still considered valid through the rest of the day.
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  // ── 1. Fetch expired open jobs ────────────────────────────
  const { data: expiredJobsData, error: fetchError } = await db
    .from("jobs")
    .select("id, title, client_id")
    .eq("status", "open")
    .not("deadline", "is", null)
    .lt("deadline", today);

  if (fetchError) {
    console.error("[expire-jobs] fetch error:", fetchError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const expiredJobs = expiredJobsData ?? [];

  if (expiredJobs.length === 0) {
    return NextResponse.json({ expired: 0, message: "Nothing to expire" });
  }

  const expiredJobIds = expiredJobs.map((j) => j.id);

  // ── 2. Filter to jobs with NO applications ────────────────
  // Jobs that received interest (any application, any status) are kept open —
  // the client should still have the chance to review and hire. Only truly
  // abandoned postings (zero applications) are auto-cancelled.
  const { data: jobsWithApps } = await db
    .from("applications")
    .select("job_id")
    .in("job_id", expiredJobIds);

  const jobIdsWithApps = new Set((jobsWithApps ?? []).map((a) => a.job_id));
  const abandonedJobs = expiredJobs.filter((j) => !jobIdsWithApps.has(j.id));

  if (abandonedJobs.length === 0) {
    return NextResponse.json({
      expired: 0,
      skipped: expiredJobs.length,
      message: "All expired jobs have applications — none cancelled",
    });
  }

  const jobIds = abandonedJobs.map((j) => j.id);

  // ── 3. Bulk-cancel abandoned expired jobs ─────────────────
  // .eq("status", "open") is the idempotency guard — safe to run twice.
  const { error: cancelError } = await db
    .from("jobs")
    .update({ status: "cancelled" })
    .in("id", jobIds)
    .eq("status", "open");

  if (cancelError) {
    console.error("[expire-jobs] cancel jobs error:", cancelError.message);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }

  // ── 4. Invalidate open-jobs cache ─────────────────────────
  revalidateTag("open-jobs", { expire: 0 });

  // ── 5. Notify clients of auto-cancelled postings ──────────
  const clientNotifications = abandonedJobs.map((job) => ({
    user_id: job.client_id,
    type: "job_expired",
    title: "Job posting expired",
    body: `Your job "${job.title}" was automatically cancelled because its deadline passed and no one applied. You can post a new job anytime.`,
    link: `/dashboard/client/jobs?tab=cancelled`,
    read: false,
  }));

  // No kinglancer notifications needed — abandoned jobs had zero applicants.

  if (clientNotifications.length > 0) {
    const { error: notifError } = await db
      .from("notifications")
      .insert(clientNotifications);

    if (notifError) {
      console.error("[expire-jobs] notifications error:", notifError.message);
    }
  }

  console.log(
    `[expire-jobs] cancelled=${abandonedJobs.length} skipped=${expiredJobs.length - abandonedJobs.length} (had applications)`,
  );

  return NextResponse.json({
    expired: abandonedJobs.length,
    skipped: expiredJobs.length - abandonedJobs.length,
    notificationsSent: clientNotifications.length,
  });
}
