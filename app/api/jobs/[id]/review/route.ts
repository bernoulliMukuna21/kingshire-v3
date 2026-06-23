import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTransactionByJob } from "@/lib/db/transactions";
import { isReviewWindowClosed } from "@/lib/db/reviews";
import { notifyReviewReceived } from "@/lib/notifications";

const MAX_COMMENT_LENGTH = 2000;

// POST /api/jobs/[id]/review — submit a review of the counterparty.
// Reviews are created hidden (double-blind). A DB trigger reveals both
// reviews the moment the second party submits; the cron reveals a lone
// review once the 7-day window closes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { rating?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be a whole number from 1 to 5." },
      { status: 400 },
    );
  }

  let comment: string | null = null;
  if (typeof body.comment === "string") {
    const trimmed = body.comment.trim();
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: "Your review is too long." },
        { status: 400 },
      );
    }
    comment = trimmed.length > 0 ? trimmed : null;
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, client_id, kinglancer_id, title")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "approved") {
    return NextResponse.json(
      { error: "You can only review a completed job." },
      { status: 409 },
    );
  }

  // Caller must be a party to the job; the reviewee is the counterparty.
  let revieweeId: string | null = null;
  let reviewerRole: "client" | "kinglancer" | null = null;
  if (user.id === job.client_id) {
    revieweeId = job.kinglancer_id;
    reviewerRole = "client";
  } else if (user.id === job.kinglancer_id) {
    revieweeId = job.client_id;
    reviewerRole = "kinglancer";
  }

  if (!revieweeId || !reviewerRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce the 7-day review window, anchored on payment release.
  const transaction = await getTransactionByJob(jobId);
  if (!transaction?.released_at) {
    return NextResponse.json(
      { error: "This job is not ready for reviews yet." },
      { status: 409 },
    );
  }
  if (isReviewWindowClosed(transaction.released_at)) {
    return NextResponse.json(
      { error: "The 7-day review window for this job has closed." },
      { status: 409 },
    );
  }

  const serviceDb = createServiceClient();
  const { error: insertError } = await serviceDb.from("reviews").insert({
    job_id: jobId,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating,
    comment,
  });

  if (insertError) {
    // 23505 = unique_violation (one review per side per job).
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You have already reviewed this job." },
        { status: 409 },
      );
    }
    console.error("[review] insert failed:", insertError.message);
    return NextResponse.json(
      { error: "Could not save your review. Please try again." },
      { status: 500 },
    );
  }

  // If both parties have now reviewed, the insert trigger published both.
  // Notify each side that a review about them is live.
  const { data: myReview } = await serviceDb
    .from("reviews")
    .select("is_published")
    .eq("job_id", jobId)
    .eq("reviewer_id", user.id)
    .single();

  const revealed = Boolean(myReview?.is_published);

  if (revealed) {
    const { data: people } = await serviceDb
      .from("profiles")
      .select("id, email")
      .in("id", [user.id, revieweeId]);
    const reviewerEmail = people?.find((p) => p.id === user.id)?.email;
    const revieweeEmail = people?.find((p) => p.id === revieweeId)?.email;
    const counterpartRole = reviewerRole === "client" ? "kinglancer" : "client";

    await Promise.all([
      revieweeEmail
        ? notifyReviewReceived({
            userId: revieweeId,
            userEmail: revieweeEmail,
            role: counterpartRole,
            jobId,
            jobTitle: job.title,
          }).catch(() => {})
        : Promise.resolve(),
      reviewerEmail
        ? notifyReviewReceived({
            userId: user.id,
            userEmail: reviewerEmail,
            role: reviewerRole,
            jobId,
            jobTitle: job.title,
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  }

  return NextResponse.json({ success: true, revealed });
}
