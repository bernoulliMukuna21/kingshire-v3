-- ============================================================
-- Migration 039: Placement start/end dates + optional reward
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive & backward-compatible:
--   * end_date added; duration is derived from start_date/end_date (still
--     stored in duration_weeks, capped at the placement maximum).
--   * reward is no longer collected (compensation types replace it), so it
--     becomes optional.
-- ============================================================

alter table public.placements
  add column if not exists end_date date;

alter table public.placements
  alter column reward drop not null;

alter table public.placements
  drop constraint if exists placements_reward_check;
