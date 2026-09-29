import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTransactionByJob } from "@/lib/db/transactions";
import { isReviewWindowClosed } from "@/lib/db/reviews";
import { notifyReviewReceived } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";
import { canManageJob } from "@/lib/organisations";

const MAX_COMMENT_LENGTH = 2000;

/**
 * Invalidate the cached public reputation pages for a user once a review
 * about them goes live, so the new review and rating appear immediately.
 */
function revalidateReputation(userId: string, role: "client" | "kinglancer") {
  if (role === "kinglancer") {
    revalidateTag(`kinglancer-profile-${userId}`, { expire: 0 });
    revalidateTag(`kinglancer-reviews-${userId}`, { expire: 0 });
    revalidateTag("kinglancer-profiles", { expire: 0 });
    revalidatePath(`/kinglancers/${userId}`);
  } else {
    revalidateTag(`client-reputation-${userId}`, { expire: 0 });
    revalidateTag(`client-reviews-${userId}`, { expire: 0 });
    revalidatePath(`/clients/${userId}`);
  }
}

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
    .select("id, status, client_id, kinglancer_id, organisation_id, title")
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
  // An authorised organisation manager may submit on behalf of the posting
  // user for an org-owned job — the review is attributed to the org, never
  // mistaken for a personal review by the original poster.
  let revieweeId: string | null = null;
  let reviewerRole: "client" | "kinglancer" | null = null;
  let effectiveReviewerId = user.id;
  let submittedByUserId: string | null = null;
  if (user.id === job.client_id) {
    revieweeId = job.kinglancer_id;
    reviewerRole = "client";
  } else if (user.id === job.kinglancer_id) {
    revieweeId = job.client_id;
    reviewerRole = "kinglancer";
  } else if (job.organisation_id) {
    if (
      !(await canManageJob(
        {
          client_id: job.client_id,
          organisation_id: job.organisation_id,
        },
        user.id,
        "manage_jobs",
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    revieweeId = job.kinglancer_id;
    reviewerRole = "client";
    // Reviews have one client-side slot. Store the posting client as the
    // reviewer so the worker's reciprocal review matches and the double-blind
    // reveal works; retain the manager who actually submitted it separately.
    effectiveReviewerId = job.client_id;
    submittedByUserId = user.id;
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
    reviewer_id: effectiveReviewerId,
    reviewee_id: revieweeId,
    rating,
    comment,
    on_behalf_of_user_id: submittedByUserId,
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
    .eq("reviewer_id", effectiveReviewerId)
    .single();

  const revealed = Boolean(myReview?.is_published);

  if (revealed) {
    // Both reviews are now public — refresh each party's reputation pages.
    // An org manager's review is attributed to the posting user, so their
    // reputation page is what gets refreshed, not the manager's.
    const reviewerForReputation = effectiveReviewerId;
    const counterpartRole = reviewerRole === "client" ? "kinglancer" : "client";
    revalidateReputation(reviewerForReputation, reviewerRole);
    revalidateReputation(revieweeId, counterpartRole);

    const { data: people } = await serviceDb
      .from("profiles")
      .select("id, email")
      .in("id", [reviewerForReputation, revieweeId]);
    const reviewerEmail = people?.find((p) => p.id === reviewerForReputation)
      ?.email;
    const revieweeEmail = people?.find((p) => p.id === revieweeId)?.email;

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
            userId: reviewerForReputation,
            userEmail: reviewerEmail,
            role: reviewerRole,
            jobId,
            jobTitle: job.title,
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  }

  await captureServerEvent({
    distinctId: user.id,
    event: "review_submitted",
    properties: {
      job_id: jobId,
      rating,
      reviewer_role: reviewerRole,
      submitted_by_user_id: submittedByUserId,
      revealed,
    },
  });

  return NextResponse.json({ success: true, revealed });
}
