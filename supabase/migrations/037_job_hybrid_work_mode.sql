-- ============================================================
-- Migration 037: Add hybrid work mode to jobs
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive & backward-compatible: widens the work_mode check to allow
-- 'hybrid' and adds days_on_site (used for hybrid jobs only). Existing rows
-- and code that omits these keep working.
-- ============================================================

alter table public.jobs
  drop constraint if exists jobs_work_mode_check;

alter table public.jobs
  add constraint jobs_work_mode_check
    check (work_mode in ('online', 'in_person', 'hybrid'));

alter table public.jobs
  add column if not exists days_on_site int
    check (days_on_site between 1 and 6);
