-- ============================================================
-- Migration 025: Dashboard performance indexes
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Notification bell summary and dropdown queries.
create index if not exists notifications_user_read_created_at_idx
  on public.notifications(user_id, read, created_at desc);

-- Dashboard job lists and action-centre slices.
create index if not exists jobs_client_status_updated_at_idx
  on public.jobs(client_id, status, updated_at desc);

create index if not exists jobs_kinglancer_status_updated_at_idx
  on public.jobs(kinglancer_id, status, updated_at desc);

create index if not exists jobs_invited_kinglancer_direct_status_created_at_idx
  on public.jobs(invited_kinglancer_id, direct_request_status, created_at desc)
  where invited_kinglancer_id is not null;

-- Dashboard totals and recent transaction lists.
create index if not exists transactions_client_status_created_at_idx
  on public.transactions(client_id, status, created_at desc);

create index if not exists transactions_kinglancer_status_created_at_idx
  on public.transactions(kinglancer_id, status, created_at desc);
