-- ============================================================
-- Migration 024: Add payment attempts before confirmed escrow
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Payment attempts represent Stripe checkout sessions/PaymentIntents that
-- have been started but are not yet confirmed escrow. Jobs/applications are
-- only moved forward after Stripe confirms payment.
create table if not exists public.payment_attempts (
  id                        uuid primary key default uuid_generate_v4(),
  job_id                    uuid not null references public.jobs(id) on delete cascade,
  application_id            uuid references public.applications(id) on delete set null,
  client_id                 uuid not null references public.profiles(id) on delete cascade,
  kinglancer_id             uuid not null references public.profiles(id) on delete cascade,
  amount                    numeric(10,2) not null,
  platform_fee_client       numeric(10,2) not null,
  platform_fee_kinglancer   numeric(10,2) not null,
  stripe_payment_intent_id  text not null unique,
  attempt_type              text not null default 'application'
                            check (attempt_type in ('application','direct_request')),
  status                    text not null default 'pending'
                            check (status in ('pending','succeeded','cancelled','failed','expired')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Keep one live checkout per job. Users can cancel or the cleanup cron can
-- expire it before another applicant/request is funded.
create unique index if not exists payment_attempts_one_pending_per_job_idx
  on public.payment_attempts(job_id)
  where status = 'pending';

create index if not exists payment_attempts_pi_idx
  on public.payment_attempts(stripe_payment_intent_id);

create index if not exists payment_attempts_client_status_created_at_idx
  on public.payment_attempts(client_id, status, created_at desc);

create index if not exists payment_attempts_pending_created_at_idx
  on public.payment_attempts(created_at)
  where status = 'pending';

drop trigger if exists on_payment_attempts_updated on public.payment_attempts;
create trigger on_payment_attempts_updated before update on public.payment_attempts
  for each row execute function public.handle_updated_at();

alter table public.payment_attempts enable row level security;

drop policy if exists "Parties can view own payment attempts" on public.payment_attempts;
create policy "Parties can view own payment attempts" on public.payment_attempts
  for select using (auth.uid() = client_id or auth.uid() = kinglancer_id);

-- Confirmed escrow transactions can optionally point back to the application
-- that was selected. Direct requests keep this null.
alter table public.transactions
  add column if not exists application_id uuid references public.applications(id) on delete set null;

grant select on public.payment_attempts to authenticated;
grant select, insert, update, delete on public.payment_attempts to service_role;
