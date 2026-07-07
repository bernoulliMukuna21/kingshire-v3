-- ============================================================
-- Migration 028: Aggregate stats RPCs + missing index
-- Run this in Supabase → SQL Editor (STAGING + PROD)
-- ============================================================
--
-- Fixes two correctness bugs identified in audit:
--
-- 1. ClientMainSection and KinglancerStatsSection fetched
--    transactions with .limit(200) to compute financial totals
--    in JavaScript. For users with >200 transactions the
--    calculation was silently wrong. These RPCs push the
--    aggregation into Postgres — no row limit, O(1) memory.
--
-- 2. Missing composite index for the client jobs tab query
--    which orders by created_at. The existing index on
--    (client_id, status, updated_at) had the wrong sort column.
-- ============================================================

-- ── 1. Client dashboard stats ─────────────────────────────
-- Returns a single row of aggregate stats for a client.
-- Uses SECURITY DEFINER so RLS policies don't interfere with
-- cross-table aggregation; consistent with increment_jobs_completed.
CREATE OR REPLACE FUNCTION get_client_stats(p_client_id UUID)
RETURNS TABLE(
  total_spent      NUMERIC,
  total_jobs       BIGINT,
  open_jobs        BIGINT,
  completed_jobs   BIGINT,
  total_applicants BIGINT
)
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    COALESCE(
      (SELECT SUM(amount + platform_fee_client)
       FROM   transactions
       WHERE  client_id = p_client_id
         AND  status IN ('held', 'released')),
      0
    ) AS total_spent,
    (SELECT COUNT(*) FROM jobs WHERE client_id = p_client_id)                                AS total_jobs,
    (SELECT COUNT(*) FROM jobs WHERE client_id = p_client_id AND status = 'open')            AS open_jobs,
    (SELECT COUNT(*) FROM jobs WHERE client_id = p_client_id AND status = 'approved')        AS completed_jobs,
    (SELECT COUNT(*)
     FROM   applications a
     JOIN   jobs j ON j.id = a.job_id
     WHERE  j.client_id = p_client_id)                                                       AS total_applicants;
$$;

-- ── 2. Kinglancer dashboard stats ─────────────────────────
-- Returns total earned (released) and total held in escrow.
CREATE OR REPLACE FUNCTION get_kinglancer_stats(p_kinglancer_id UUID)
RETURNS TABLE(
  total_earned NUMERIC,
  total_held   NUMERIC
)
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    COALESCE(SUM(CASE WHEN status = 'released' THEN amount - platform_fee_kinglancer ELSE 0 END), 0) AS total_earned,
    COALESCE(SUM(CASE WHEN status = 'held'     THEN amount - platform_fee_kinglancer ELSE 0 END), 0) AS total_held
  FROM transactions
  WHERE kinglancer_id = p_kinglancer_id;
$$;

-- ── 3. Missing index for client jobs tab query ─────────────
-- The paginated client jobs page orders by created_at but the
-- only composite index with client_id + status used updated_at.
-- This lets Postgres serve tab queries with an index-only scan.
CREATE INDEX IF NOT EXISTS jobs_client_status_created_at_idx
  ON public.jobs (client_id, status, created_at DESC);
