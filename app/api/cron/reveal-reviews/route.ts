import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyReviewReceived } from "@/lib/notifications";

type RevealedRow = { review_id: string; reviewee_id: string; job_id: string };

// GET /api/cron/reveal-reviews
// Publishes reviews whose 7-day double-blind window has elapsed and notifies
// each reviewee. Secured via CRON_SECRET (same scheme as auto-release).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    // Dev only: allow unauthenticated access when secret is not set.
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any).rpc(
    "reveal_expired_reviews",
  );

  if (error) {
    console.error("reveal-reviews: RPC failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const revealed = (data ?? []) as RevealedRow[];

  if (revealed.length === 0) {
    return NextResponse.json({ revealed: 0, message: "Nothing to reveal" });
  }

  // Load the data needed to notify each reviewee.
  const revieweeIds = [...new Set(revealed.map((r) => r.reviewee_id))];
  const jobIds = [...new Set(revealed.map((r) => r.job_id))];

  const [{ data: profiles }, { data: jobs }] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, email, role")
      .in("id", revieweeIds),
    serviceClient.from("jobs").select("id, title").in("id", jobIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const jobTitleById = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  await Promise.all(
    revealed.map((row) => {
      const profile = profileById.get(row.reviewee_id);
      const role = profile?.role;
      if (!profile?.email || (role !== "client" && role !== "kinglancer")) {
        return Promise.resolve();
      }
      return notifyReviewReceived({
        userId: row.reviewee_id,
        userEmail: profile.email,
        role,
        jobId: row.job_id,
        jobTitle: jobTitleById.get(row.job_id) ?? "your job",
      }).catch(() => {});
    }),
  );

  console.log(`reveal-reviews: revealed ${revealed.length} reviews`);

  return NextResponse.json({ revealed: revealed.length });
}
