-- ============================================================
-- Migration 023: Direct Kinglancer job requests
-- Run this in Supabase → SQL Editor
-- ============================================================

alter table public.jobs
  add column if not exists invited_kinglancer_id uuid references public.profiles(id),
  add column if not exists direct_request_status text
    check (direct_request_status is null or direct_request_status in (
      'pending',
      'changes_requested',
      'accepted_pending_payment',
      'declined',
      'cancelled'
    )),
  add column if not exists direct_request_message text,
  add column if not exists counter_budget numeric(10,2),
  add column if not exists counter_rate_type text
    check (counter_rate_type is null or counter_rate_type in ('fixed','per_hour','per_day')),
  add column if not exists counter_deadline date;

create index if not exists jobs_invited_kinglancer_status_idx
  on public.jobs(invited_kinglancer_id, direct_request_status, created_at desc)
  where invited_kinglancer_id is not null;

-- Direct jobs are private to the client, invited Kinglancer, assigned
-- Kinglancer, and service-role/admin paths. Public browse remains public only
-- for non-direct jobs.
drop policy if exists "Jobs are viewable by everyone" on public.jobs;
create policy "Jobs are viewable by relevant users" on public.jobs
  for select using (
    invited_kinglancer_id is null
    OR auth.uid() = client_id
    OR auth.uid() = invited_kinglancer_id
    OR auth.uid() = kinglancer_id
    OR (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Direct requests are handled by accept/decline/change-request actions, not
-- normal applications. This keeps private invites out of the public apply flow.
drop policy if exists "Kinglancers can apply" on public.applications;
create policy "Kinglancers can apply" on public.applications
  for insert with check (
    auth.uid() = kinglancer_id
    AND (select role from public.profiles where id = auth.uid()) = 'kinglancer'
    AND (select status from public.jobs where id = job_id) = 'open'
    AND (select invited_kinglancer_id from public.jobs where id = job_id) is null
  );

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_application',
    'job_awarded',
    'work_submitted',
    'payment_released',
    'dispute_raised',
    'new_job',
    'payout_ready',
    'direct_request'
  ));
