-- ============================================================
-- Migration 019: Add MVP performance indexes
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Public browse pages and dashboard job lookups.
create index if not exists jobs_status_created_at_idx
  on public.jobs(status, created_at desc);

create index if not exists jobs_client_created_at_idx
  on public.jobs(client_id, created_at desc);

create index if not exists jobs_completed_updated_at_idx
  on public.jobs(updated_at)
  where status = 'completed';

-- Applicant/dashboard lookups and application counts by job.
create index if not exists applications_kinglancer_created_at_idx
  on public.applications(kinglancer_id, created_at desc);

create index if not exists applications_job_status_idx
  on public.applications(job_id, status);

-- Transaction history, dashboard totals, cleanup, and payout retry paths.
create index if not exists transactions_client_created_at_idx
  on public.transactions(client_id, created_at desc);

create index if not exists transactions_kinglancer_created_at_idx
  on public.transactions(kinglancer_id, created_at desc);

create index if not exists transactions_pending_created_at_idx
  on public.transactions(created_at)
  where status = 'pending';

create index if not exists transactions_released_untransferred_idx
  on public.transactions(kinglancer_id, created_at)
  where status = 'released' and stripe_transfer_id is null;

-- Kinglancer directory and new-job notification recipient lookup.
create index if not exists profiles_kinglancer_jobs_completed_idx
  on public.profiles(jobs_completed desc)
  where role = 'kinglancer';
