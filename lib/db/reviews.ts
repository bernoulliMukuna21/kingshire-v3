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
