-- ============================================================
-- Migration 035: Job work mode (online / in-person attendance)
-- Run this in Supabase → SQL Editor
-- ============================================================
--
-- Additive & backward-compatible: existing code that omits these columns
-- keeps working (work_mode defaults to 'online', the rest are nullable).
-- For in-person jobs the client provides a location and an attendance time.
-- ============================================================

alter table public.jobs
  add column if not exists work_mode text not null default 'online'
    check (work_mode in ('online', 'in_person')),
  add column if not exists location text,
  add column if not exists scheduled_at timestamptz;
