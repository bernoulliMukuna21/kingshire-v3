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

  const jobIds = expiredJobs.map((j) => j.id);

  // ── 2. Fetch pending applicants BEFORE rejecting them ─────
  // (needed to know who to notify)
  const { data: applicationsData } = await db
    .from("applications")
    .select("kinglancer_id")
    .in("job_id", jobIds)
    .eq("status", "pending");

  const applications = applicationsData ?? [];

  // ── 3. Bulk-reject pending applications ──────────────────
  const { error: rejectError } = await db
    .from("applications")
    .update({ status: "rejected" })
    .in("job_id", jobIds)
    .eq("status", "pending");

  if (rejectError) {
    // Non-fatal — log and continue to cancel jobs
    console.error(
      "[expire-jobs] reject applications error:",
      rejectError.message,
    );
  }

  // ── 4. Bulk-cancel expired jobs ───────────────────────────
  // .eq("status", "open") is the idempotency guard — already-cancelled jobs
  // are not touched if the cron somehow runs twice.
  const { error: cancelError } = await db
    .from("jobs")
    .update({ status: "cancelled" })
    .in("id", jobIds)
    .eq("status", "open");

  if (cancelError) {
    console.error("[expire-jobs] cancel jobs error:", cancelError.message);
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 });
  }

  // ── 5. Invalidate open-jobs cache ─────────────────────────
  revalidateTag("open-jobs", { expire: 0 });

  // ── 6. Bulk-insert in-app notifications ──────────────────
  const clientNotifications = expiredJobs.map((job) => ({
    user_id: job.client_id,
    type: "job_expired",
    title: "Job posting expired",
    body: `Your job "${job.title}" was automatically cancelled because its deadline passed. You can post a new job anytime.`,
    link: `/dashboard/client/jobs?tab=cancelled`,
    read: false,
  }));

  // Deduplicate kinglancer IDs — a kinglancer could theoretically have
  // multiple pending applications expiring at once.
  const uniqueKinglancerIds = [
    ...new Set(applications.map((a) => a.kinglancer_id)),
  ];

  const kinglancerNotifications = uniqueKinglancerIds.map((kinglancerId) => ({
    user_id: kinglancerId,
    type: "job_expired",
    title: "A job you applied for has expired",
    body: "One or more jobs you applied for have been cancelled because their deadlines passed.",
    link: "/dashboard/kinglancer/jobs",
    read: false,
  }));

  const allNotifications = [...clientNotifications, ...kinglancerNotifications];

  if (allNotifications.length > 0) {
    const { error: notifError } = await db
      .from("notifications")
      .insert(allNotifications);

    if (notifError) {
      // Non-fatal — notifications are nice-to-have
      console.error("[expire-jobs] notifications error:", notifError.message);
    }
  }

  console.log(
    `[expire-jobs] expired=${expiredJobs.length} applicationsRejected=${applications.length} notificationsSent=${allNotifications.length}`,
  );

  return NextResponse.json({
    expired: expiredJobs.length,
    applicationsRejected: applications.length,
    notificationsSent: allNotifications.length,
  });
}
