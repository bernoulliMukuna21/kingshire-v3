-- ============================================================
-- Migration 038: Job attendance end time
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive & backward-compatible. In-person jobs run between a start
-- (scheduled_at) and an end (ends_at). Existing rows keep ends_at null.
-- ============================================================

alter table public.jobs
  add column if not exists ends_at timestamptz;
