-- ============================================================
-- Migration 057: Job schedule type (fixed shift vs flexible window)
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- In-person jobs carry a start/end time. That window is ambiguous today:
--   'shift'  — the Kinglancer works those exact hours (e.g. an event shift)
--   'window' — the Kinglancer completes the task any time within the window
--              (the £ is fixed for the task, not the hours)
-- Additive & backward-compatible: existing jobs default to 'window'.
-- Optional estimated_minutes lets a window job hint how long it really takes.
-- Only meaningful for in-person jobs; online/hybrid jobs ignore it.
-- ============================================================

alter table public.jobs
  add column if not exists schedule_type text not null default 'window'
    check (schedule_type in ('shift', 'window'));

alter table public.jobs
  add column if not exists estimated_minutes int
    check (estimated_minutes is null or estimated_minutes between 15 and 1440);
