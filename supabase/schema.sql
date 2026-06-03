-- ============================================================
-- KingsHire Database Schema
-- Run this in Supabase → SQL Editor → New query
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────
-- One profile per auth user. Created automatically on sign-up.
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text not null,
  avatar_url      text,
  phone           text,
  role            text check (role is null or role in ('client', 'kinglancer', 'admin')),
  bio             text,
  service_tags    text[] not null default '{}',
  location        text,
  hourly_rate     numeric(10,2),
  rate_type       text not null default 'per_hour' check (rate_type in ('per_hour','per_day','per_project')),
  tagline         text,
  services        jsonb not null default '[]',
  rating          numeric(3,2) not null default 0,
  total_reviews   integer not null default 0,
  jobs_completed  integer not null default 0,
  is_verified     boolean not null default false,
  portfolio_url   text,
  cv_url          text,
  stripe_account_id         text,
  stripe_onboarding_complete boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── JOBS ──────────────────────────────────────────────────
create table public.jobs (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text not null,
  budget           numeric(10,2) not null,
  categories       text[] not null default '{}',
  service_tags_required text[] not null default '{}',
  rate_type        text not null default 'fixed' check (rate_type in ('fixed','per_hour','per_day')),
  status           text not null default 'open' check (status in ('open','in_progress','completed','cancelled','disputed','approved')),
  deadline         date,
  kinglancer_id    uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── APPLICATIONS ──────────────────────────────────────────
create table public.applications (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  kinglancer_id   uuid not null references public.profiles(id) on delete cascade,
  cover_letter    text not null,
  proposed_rate   numeric(10,2),
  status          text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at      timestamptz not null default now(),
  unique(job_id, kinglancer_id)
);

-- ── TRANSACTIONS ──────────────────────────────────────────
create table public.transactions (
  id                        uuid primary key default uuid_generate_v4(),
  job_id                    uuid not null references public.jobs(id),
  client_id                 uuid not null references public.profiles(id),
  kinglancer_id             uuid not null references public.profiles(id),
  amount                    numeric(10,2) not null,
  platform_fee_client       numeric(10,2) not null,
  platform_fee_kinglancer   numeric(10,2) not null,
  stripe_payment_intent_id  text unique,
  stripe_transfer_id        text,
  status                    text not null default 'pending' check (status in ('pending','held','released','refunded','disputed')),
  released_at               timestamptz,
  created_at                timestamptz not null default now(),
  unique(job_id)
);

-- ── REVIEWS ───────────────────────────────────────────────
create table public.reviews (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid not null references public.jobs(id),
  reviewer_id  uuid not null references public.profiles(id),
  reviewee_id  uuid not null references public.profiles(id),
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique(job_id, reviewer_id)
);

-- ── DISPUTES ──────────────────────────────────────────────
create table public.disputes (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid not null references public.jobs(id),
  raised_by    uuid not null references public.profiles(id),
  reason       text not null,
  status       text not null default 'open' check (status in ('open','resolved','closed')),
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- ============================================================
-- PROFILE FIELD PROTECTION TRIGGER
-- Prevents authenticated users from writing to system-managed
-- columns via the Supabase client. Service role bypasses this.
-- ============================================================
create or replace function public.restrict_profile_update()
returns trigger language plpgsql security definer as $$
declare
  jwt_role text;
begin
  begin
    jwt_role := (current_setting('request.jwt.claims', true)::jsonb)->>'role';
  exception when others then
    jwt_role := null;
  end;

  if jwt_role = 'authenticated' then
    new.role                       := old.role;
    new.rating                     := old.rating;
    new.jobs_completed             := old.jobs_completed;
    new.is_verified                := old.is_verified;
    new.stripe_account_id          := old.stripe_account_id;
    new.stripe_onboarding_complete := old.stripe_onboarding_complete;
  end if;
  return new;
end;
$$;

create trigger on_profile_update_restrict
  before update on public.profiles
  for each row execute function public.restrict_profile_update();

-- ============================================================
-- INCREMENT_JOBS_COMPLETED RPC
-- Called by the approve route after a job is successfully paid.
-- Uses SECURITY DEFINER so it can write to profiles regardless
-- of the caller's JWT role. Only increments by 1 per call.
-- ============================================================
create or replace function public.increment_jobs_completed(user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set jobs_completed = coalesce(jobs_completed, 0) + 1
  where id = user_id;
end;
$$;

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger on_jobs_updated before update on public.jobs
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, service_tags, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when nullif(new.raw_user_meta_data->>'role', '') in ('client', 'kinglancer')
        then nullif(new.raw_user_meta_data->>'role', '')
      else null
    end,
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'service_tags')),
      '{}'::text[]
    ),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.jobs         enable row level security;
alter table public.applications enable row level security;
alter table public.transactions enable row level security;
alter table public.reviews      enable row level security;
alter table public.disputes     enable row level security;

-- Profiles: anyone can read, only owner can write user-editable fields.
-- System-managed fields (role, rating, jobs_completed, is_verified,
-- stripe_account_id, stripe_onboarding_complete) are protected by the
-- restrict_profile_update trigger below — the trigger silently reverts
-- them to their current values whenever the authenticated role tries to
-- overwrite them, so only the service role can change them.
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Jobs: anyone can read open jobs, only owner can insert/update.
-- Direct client edits are restricted to open jobs only (before a kinglancer
-- is selected). All status transitions go through server routes that use the
-- service role and bypass RLS, so no kinglancer update policy is needed.
create policy "Jobs are viewable by everyone" on public.jobs
  for select using (true);
-- Only a client (by profile role) can post jobs.
create policy "Clients can create jobs" on public.jobs
  for insert with check (
    auth.uid() = client_id
    AND (select role from public.profiles where id = auth.uid()) = 'client'
  );
create policy "Clients can update own jobs" on public.jobs
  for update using (auth.uid() = client_id AND status = 'open')
  with check (auth.uid() = client_id AND status = 'open');

-- Applications: kinglancer sees own, client sees apps on their jobs.
-- All application status updates go through selectApplicant() which uses
-- the service client — no client-facing update policy is needed.
create policy "Kinglancers see own applications" on public.applications
  for select using (auth.uid() = kinglancer_id);
create policy "Clients see applications on their jobs" on public.applications
  for select using (
    exists (select 1 from public.jobs where id = job_id and client_id = auth.uid())
  );
-- Only a kinglancer (by profile role) can apply, and only to open jobs.
create policy "Kinglancers can apply" on public.applications
  for insert with check (
    auth.uid() = kinglancer_id
    AND (select role from public.profiles where id = auth.uid()) = 'kinglancer'
    AND (select status from public.jobs where id = job_id) = 'open'
  );

-- Transactions: only parties involved can view.
-- All inserts and updates go through server routes that use the service role.
-- No insert or update RLS policy is needed — service role bypasses RLS.
create policy "Parties can view own transactions" on public.transactions
  for select using (auth.uid() = client_id or auth.uid() = kinglancer_id);

-- Transactions are updated only via service role (webhooks, cron, server routes).
-- No RLS update policy needed — service role bypasses RLS.
-- This prevents any client-side actor from forging a status change.

-- Reviews: anyone can read, only reviewer can insert
create policy "Reviews are public" on public.reviews
  for select using (true);
create policy "Users can leave a review" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    AND reviewer_id <> reviewee_id
    AND exists (
      select 1 from public.jobs
      where jobs.id = reviews.job_id
        AND jobs.status = 'approved'
        AND (
          (jobs.client_id = reviews.reviewer_id AND jobs.kinglancer_id = reviews.reviewee_id)
          OR
          (jobs.kinglancer_id = reviews.reviewer_id AND jobs.client_id = reviews.reviewee_id)
        )
    )
  );

-- Disputes: only parties involved can view/create
create policy "Parties can view disputes" on public.disputes
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = disputes.job_id
        AND (jobs.client_id = auth.uid() OR jobs.kinglancer_id = auth.uid())
    )
  );
create policy "Users can raise disputes" on public.disputes
  for insert with check (
    auth.uid() = raised_by
    AND exists (
      select 1 from public.jobs
      where jobs.id = disputes.job_id
        AND jobs.status in ('in_progress', 'completed')
        AND (jobs.client_id = auth.uid() OR jobs.kinglancer_id = auth.uid())
    )
  );

-- ── NOTIFICATIONS ──────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in (
                'new_application',
                'job_awarded',
                'work_submitted',
                'payment_released',
                'dispute_raised',
                'new_job',
                'payout_ready'
              )),
  title       text not null,
  body        text not null,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications(user_id, created_at desc);

-- ── PERFORMANCE INDEXES ─────────────────────────────────────
create index if not exists jobs_status_created_at_idx
  on public.jobs(status, created_at desc);

create index if not exists jobs_client_created_at_idx
  on public.jobs(client_id, created_at desc);

create index if not exists jobs_completed_updated_at_idx
  on public.jobs(updated_at)
  where status = 'completed';

create index if not exists applications_kinglancer_created_at_idx
  on public.applications(kinglancer_id, created_at desc);

create index if not exists applications_job_status_idx
  on public.applications(job_id, status);

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

create index if not exists profiles_kinglancer_jobs_completed_idx
  on public.profiles(jobs_completed desc)
  where role = 'kinglancer';

alter table public.notifications enable row level security;

create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE — AVATARS BUCKET
-- Run AFTER creating the 'avatars' bucket in Supabase Storage.
-- Bucket is public (reads are open). These policies guard writes.
-- ============================================================
create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- ROLE GRANTS
-- Object-level privileges must be granted explicitly even when
-- RLS is enabled. RLS policies are the actual security boundary;
-- these grants just allow the roles to reach the table at all.
--   anon        → public read-only access (RLS restricts further)
--   authenticated → full CRUD (RLS restricts further)
--   service_role  → full CRUD, bypasses RLS (used by server routes)
-- ============================================================
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
