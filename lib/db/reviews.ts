import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

/** Days a review may be submitted after a job's payment is released. */
export const REVIEW_WINDOW_DAYS = 7;

/** True once the double-blind review window has elapsed for a released job. */
export function isReviewWindowClosed(releasedAt: string | null): boolean {
  if (!releasedAt) return false;
  const windowMs = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(releasedAt).getTime() > windowMs;
}

/**
 * Human label + urgency for how long is left to leave a review. Returns null
 * when there is no deadline (e.g. payment not yet released). Kept out of
 * component render bodies because it reads `Date.now()`.
 */
export function reviewWindowRemaining(
  closesAt: string | null,
): { label: string; urgent: boolean } | null {
  if (!closesAt) return null;
  const msLeft = new Date(closesAt).getTime() - Date.now();
  if (msLeft <= 0) return null;

  const hoursLeft = msLeft / (60 * 60 * 1000);
  if (hoursLeft <= 24) {
    const hours = Math.max(1, Math.round(hoursLeft));
    return {
      label: hours <= 1 ? "Closes within the hour" : `${hours} hours left`,
      urgent: true,
    };
  }

  const days = Math.ceil(hoursLeft / 24);
  return { label: `${days} days left`, urgent: false };
}

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
  } | null;
};

export type JobReviewState = {
  /** The viewer's own review of the counterparty, if they have submitted one. */
  myReview: Pick<
    ReviewRow,
    "id" | "rating" | "comment" | "is_published"
  > | null;
  /** The counterparty's review of the viewer — only present once published. */
  counterpartReview: Pick<
    ReviewRow,
    "rating" | "comment" | "published_at"
  > | null;
};

/**
 * Returns the double-blind review state for a job from the viewer's
 * perspective: their own review (any state) and the counterparty's review
 * only once it has been published.
 */
export async function getJobReviewState(
  jobId: string,
  viewerId: string,
): Promise<JobReviewState> {
  const db = createServiceClient();
  const { data } = await db
    .from("reviews")
    .select(
      "id, reviewer_id, reviewee_id, rating, comment, is_published, published_at",
    )
    .eq("job_id", jobId);

  const rows = data ?? [];
  const mine = rows.find((r) => r.reviewer_id === viewerId) ?? null;
  const aboutMe = rows.find((r) => r.reviewee_id === viewerId) ?? null;

  return {
    myReview: mine
      ? {
          id: mine.id,
          rating: mine.rating,
          comment: mine.comment,
          is_published: mine.is_published,
        }
      : null,
    counterpartReview:
      aboutMe && aboutMe.is_published
        ? {
            rating: aboutMe.rating,
            comment: aboutMe.comment,
            published_at: aboutMe.published_at,
          }
        : null,
  };
}

export type PendingReviewJob = {
  jobId: string;
  jobTitle: string;
  counterpartName: string | null;
  counterpartRole: "client" | "kinglancer";
  /** ISO timestamp when the 7-day window closes, or null if not yet released. */
  closesAt: string | null;
};

/**
 * Jobs for which `userId` (acting as `role`) still owes a review: the job is
 * approved, the review window is still open, and they have not yet submitted
 * one. Used to surface "Leave a review" as an Action Centre item.
 */
export async function getPendingReviewJobs(
  userId: string,
  role: "client" | "kinglancer",
): Promise<PendingReviewJob[]> {
  const db = createServiceClient();
  const ownerColumn = role === "client" ? "client_id" : "kinglancer_id";
  const counterpartColumn = role === "client" ? "kinglancer_id" : "client_id";

  const { data: jobsRaw } = await db
    .from("jobs")
    .select(`id, title, counterpart:profiles!${counterpartColumn}(full_name)`)
    .eq(ownerColumn, userId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  const jobs = jobsRaw ?? [];
  if (jobs.length === 0) return [];
  const jobIds = jobs.map((job) => job.id);

  const [txResult, reviewResult] = await Promise.all([
    db.from("transactions").select("job_id, released_at").in("job_id", jobIds),
    db
      .from("reviews")
      .select("job_id")
      .in("job_id", jobIds)
      .eq("reviewer_id", userId),
  ]);

  const releasedAtByJob = new Map(
    (txResult.data ?? []).map((tx) => [tx.job_id, tx.released_at]),
  );
  const reviewedJobIds = new Set(
    (reviewResult.data ?? []).map((review) => review.job_id),
  );

  return jobs
    .filter((job) => {
      if (reviewedJobIds.has(job.id)) return false;
      return !isReviewWindowClosed(releasedAtByJob.get(job.id) ?? null);
    })
    .map((job) => {
      const counterpart = Array.isArray(job.counterpart)
        ? job.counterpart[0]
        : job.counterpart;
      const releasedAt = releasedAtByJob.get(job.id) ?? null;
      const closesAt = releasedAt
        ? new Date(
            new Date(releasedAt).getTime() +
              REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;
      return {
        jobId: job.id,
        jobTitle: job.title,
        counterpartName: counterpart?.full_name ?? null,
        counterpartRole: role === "client" ? "kinglancer" : "client",
        closesAt,
      };
    });
}

/** Published reviews written ABOUT a user, newest first, with reviewer info. */
export async function getPublishedReviewsForUser(
  revieweeId: string,
  limit = 50,
): Promise<PublicReview[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("reviews")
    .select(
      "id, rating, comment, created_at, reviewer:profiles!reviewer_id(id, full_name, avatar_url, role)",
    )
    .eq("reviewee_id", revieweeId)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const reviewer = Array.isArray(row.reviewer)
      ? row.reviewer[0]
      : row.reviewer;
    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      reviewer: reviewer ?? null,
    };
  }) as PublicReview[];
}
