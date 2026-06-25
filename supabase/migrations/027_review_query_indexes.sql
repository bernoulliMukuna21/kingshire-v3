-- ============================================================
-- Migration 027: Additional indexes for review query paths
-- Run this in Supabase → SQL Editor (PROD + STAGING)
-- ============================================================
--
-- Fixes two missing index paths identified in audit:
--
-- 1. getPendingReviewJobs: queries reviews WHERE reviewer_id = $1
--    AND job_id IN (...). Without an index on reviewer_id, Postgres
--    does a full-table scan on every dashboard load for users with
--    approved jobs. This grows linearly with total platform reviews.
--
-- 2. getPublishedReviewsForUser: queries by reviewee_id, filters
--    is_published=true, and orders by published_at DESC. The existing
--    idx_reviews_reviewee_published partial index covers the filter
--    but not the sort. Postgres has to heap-fetch and re-sort.
--    The compound index lets Postgres serve rows already in order.
-- ============================================================

-- ── 1. Reviewer lookup (pending review check) ───────────────
create index if not exists idx_reviews_reviewer_job
  on public.reviews (reviewer_id, job_id);

-- ── 2. Published profile reviews with sort ──────────────────
-- Replaces the narrower idx_reviews_reviewee_published for the
-- getPublishedReviewsForUser query path. The old index is kept
-- since it may still be used by other queries (e.g. trigger scans).
create index if not exists idx_reviews_reviewee_published_at
  on public.reviews (reviewee_id, published_at desc)
  where is_published;
