-- ============================================================
-- APPLY migrations 035 -> 056 to PRODUCTION (ref mdzousozzrnggtblusws)
-- Prod verified at 034; this brings it fully up to 056.
-- Paste this whole file into Supabase SQL Editor (prod) and run once.
-- Wrapped in a transaction: all-or-nothing. If the editor rejects
-- begin/commit, delete those two lines and re-run.
-- ============================================================

begin;

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
-- ============================================================
-- Migration 036: Placement work mode + compensation
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive & backward-compatible:
--   * work_mode replaces the boolean is_remote (kept in sync by the app for
--     now); existing rows default to 'remote' and are then reclassified.
--   * days_on_site applies to hybrid placements only.
--   * compensation_types is an optional multi-select; compensation_note holds
--     the explanation required when 'other' is chosen.
-- ============================================================

alter table public.placements
  add column if not exists work_mode text not null default 'remote'
    check (work_mode in ('remote', 'hybrid', 'onsite')),
  add column if not exists days_on_site int
    check (days_on_site between 1 and 6),
  add column if not exists compensation_types text[] not null default '{}',
  add column if not exists compensation_note text;

-- Reclassify any pre-existing rows from the legacy is_remote flag.
update public.placements
  set work_mode = case when is_remote then 'remote' else 'onsite' end;
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
-- ============================================================
-- Migration 040: Placement compensation details
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive. Each selected compensation type carries a clarification:
--   money      -> { amount, cadence }
--   other kinds -> a details string
-- Stored as a JSON map keyed by compensation type. compensation_note is
-- superseded and left in place for backward compatibility.
-- ============================================================

alter table public.placements
  add column if not exists compensation_details jsonb not null default '{}';
-- ============================================================
-- 041 — CV attachments on placement applications
-- Additive/backward-compatible: nullable column + storage bucket.
-- ============================================================

alter table public.placement_applications
  add column if not exists cv_url text;

-- Public bucket for applicant CVs (unguessable per-user paths).
insert into storage.buckets (id, name, public)
values ('placement-cvs', 'placement-cvs', true)
on conflict (id) do nothing;

drop policy if exists "Placement CVs are publicly accessible" on storage.objects;
create policy "Placement CVs are publicly accessible" on storage.objects
  for select using (bucket_id = 'placement-cvs');

drop policy if exists "Users can upload their own placement CV" on storage.objects;
create policy "Users can upload their own placement CV" on storage.objects
  for insert with check (
    bucket_id = 'placement-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own placement CV" on storage.objects;
create policy "Users can update their own placement CV" on storage.objects
  for update using (
    bucket_id = 'placement-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
-- ============================================================
-- 042 — Placement payment mode (managed vs direct)
-- Additive/backward-compatible: nullable-with-default column.
-- 'direct'  = the organisation pays the Kinglancer themselves (record only).
-- 'managed' = KingsHire collects from the organisation and pays the
--             Kinglancer monthly (escrow + payout). Only valid when the
--             placement offers money compensation.
-- ============================================================

alter table public.placements
  add column if not exists payment_mode text not null default 'direct'
    check (payment_mode in ('managed', 'direct'));
-- ============================================================
-- 043 — Managed placement payments (monthly)
-- Adds the monthly amount + payment mode to agreements, and a per-month
-- payment ledger. Additive/backward-compatible.
-- ============================================================

-- Carry the funding model + monthly amount onto the agreement at acceptance,
-- so payments don't need to re-read the placement's compensation each time.
alter table public.placement_agreements
  add column if not exists payment_mode text not null default 'direct'
    check (payment_mode in ('managed', 'direct'));
alter table public.placement_agreements
  add column if not exists monthly_amount numeric(10, 2);

-- ── PLACEMENT PAYMENTS (managed, one row per month) ───────
-- amount = monthly compensation to the Kinglancer (gross). The org is charged
-- amount + platform_fee_client; the Kinglancer receives amount − platform_fee_
-- kinglancer. Mirrors the jobs escrow fee split.
create table if not exists public.placement_payments (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null references public.placement_agreements(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  period_index int not null check (period_index >= 1),
  due_date date,
  amount numeric(10, 2) not null check (amount > 0),
  platform_fee_client numeric(10, 2) not null default 0,
  platform_fee_kinglancer numeric(10, 2) not null default 0,
  status text not null default 'due'
    check (status in ('due', 'processing', 'held', 'released', 'failed', 'cancelled')),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, period_index)
);

create index if not exists placement_payments_agreement_idx
  on public.placement_payments (agreement_id, period_index);

create trigger on_placement_payments_updated
  before update on public.placement_payments
  for each row execute function public.handle_updated_at();

alter table public.placement_payments enable row level security;

-- Participant or an org member may read the payment ledger; writes go through
-- the service role only (mirrors the rest of the placement tables).
create policy "Read placement payments via agreement"
  on public.placement_payments
  for select using (
    exists (
      select 1 from public.placement_agreements a
      where a.id = placement_payments.agreement_id
        and (
          a.kinglancer_id = auth.uid()
          or exists (
            select 1 from public.organisation_members
            where organisation_id = a.organisation_id
              and user_id = auth.uid()
          )
        )
    )
  );
-- ============================================================
-- 044 — Verified experience: admin approval + category scoping
-- A completed placement creates a PENDING experience record; it only becomes
-- a visible "verified" badge after an admin approves it. Additive.
-- ============================================================

alter table public.experience_records
  add column if not exists categories text[] not null default '{}';
alter table public.experience_records
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected'));
alter table public.experience_records
  add column if not exists verified_at timestamptz;
alter table public.experience_records
  add column if not exists verified_by uuid references public.profiles(id);

-- Admin review queue lookup.
create index if not exists experience_records_pending_idx
  on public.experience_records (created_at desc)
  where verification_status = 'pending';
-- ============================================================
-- 045 — Raise the placement weekly-hours cap from 16 to 20
-- Supervised part-time placements may now run up to 20h/week.
-- ============================================================

alter table public.placements
  drop constraint if exists placements_weekly_hours_check;
alter table public.placements
  add constraint placements_weekly_hours_check
  check (weekly_hours between 1 and 20);

alter table public.placement_agreements
  drop constraint if exists placement_agreements_weekly_hours_check;
alter table public.placement_agreements
  add constraint placement_agreements_weekly_hours_check
  check (weekly_hours between 1 and 20);
-- ============================================================
-- 046 — Grant privileges on placement_payments
-- Migration 043 created the table + RLS but omitted the table grants that
-- every other placement table has, so the service role hit
-- "permission denied for table placement_payments". Additive/idempotent.
-- ============================================================

grant select on public.placement_payments to authenticated;
grant all on public.placement_payments to service_role;
-- ============================================================
-- 047 — Placement payment escrow: disputes + release notice
-- Managed months are now held in escrow and released at month-end after a
-- notice period, unless the org disputes. Additive/backward-compatible.
-- ============================================================

alter table public.placement_payments
  drop constraint if exists placement_payments_status_check;
alter table public.placement_payments
  add constraint placement_payments_status_check
  check (
    status in (
      'due',
      'processing',
      'held',
      'released',
      'failed',
      'cancelled',
      'disputed',
      'refunded'
    )
  );

-- When the "we're about to release" notice was emailed to the org.
alter table public.placement_payments
  add column if not exists notice_sent_at timestamptz;

-- Why the org disputed this month (for the admin resolving it).
alter table public.placement_payments
  add column if not exists dispute_reason text;
-- ============================================================
-- 048 — Mutual early end of a placement agreement
-- Either party can propose ending an active placement early; it only ends
-- once the other party confirms. Additive/backward-compatible.
-- ============================================================

alter table public.placement_agreements
  add column if not exists end_requested_by uuid
    references public.profiles(id) on delete set null;
alter table public.placement_agreements
  add column if not exists end_requested_at timestamptz;
alter table public.placement_agreements
  add column if not exists end_reason text;
-- ============================================================
-- 049 — Placement agreement 'pending_funding' state
-- After the Kinglancer accepts a managed placement, the agreement waits in
-- 'pending_funding' until the organisation explicitly funds the first month.
-- Funding month 1 activates it. Additive/backward-compatible.
-- ============================================================

alter table public.placement_agreements
  drop constraint if exists placement_agreements_status_check;

alter table public.placement_agreements
  add constraint placement_agreements_status_check
    check (status in (
      'pending_acceptance',
      'pending_funding',
      'active',
      'completed',
      'cancelled'
    ));
-- ============================================================
-- 050 — Per-side archive (hide) for placements & agreements
-- Lets an org hide a wound-down placement from its own lists, and a Kinglancer
-- hide a finished agreement from theirs, without affecting the other party or
-- deleting shared history. Additive/backward-compatible.
-- ============================================================

alter table public.placements
  add column if not exists archived_at timestamptz;

alter table public.placement_agreements
  add column if not exists kinglancer_archived_at timestamptz;
-- ============================================================
-- 051 — Terms & Conditions re-consent
-- Records which version of the platform terms each user has accepted, so a
-- material change (e.g. fees) can prompt non-admins to re-agree. Existing users
-- backfill to 0 (below the current version) and are re-prompted; new users are
-- set to the current version when they complete onboarding. Additive.
-- ============================================================

alter table public.profiles
  add column if not exists terms_accepted_version integer not null default 0;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;
-- 052 — Scope client stats to PERSONAL jobs only.
-- A client who belongs to an organisation can post both personal jobs
-- (organisation_id IS NULL) and org-owned jobs. The personal dashboard must
-- count/spend only PERSONAL jobs; org jobs belong to the org workspace.
-- Mirrors the read-side invariant: personal scope = client_id AND organisation_id IS NULL.

create or replace function public.get_client_stats(p_client_id uuid)
returns table(
  total_spent      numeric,
  total_jobs       bigint,
  open_jobs        bigint,
  completed_jobs   bigint,
  total_applicants bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_client_id then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select
      coalesce(
        (select sum(t.amount + t.platform_fee_client)
         from   transactions t
         join   jobs j on j.id = t.job_id
         where  t.client_id = p_client_id
           and  t.status in ('held', 'released')
           and  j.organisation_id is null),
        0
      ) as total_spent,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null)                       as total_jobs,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null and status = 'open')   as open_jobs,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null and status = 'approved') as completed_jobs,
      (select count(*)
       from   applications a
       join   jobs j on j.id = a.job_id
       where  j.client_id = p_client_id and j.organisation_id is null)                   as total_applicants;
end;
$$;
-- ============================================================
-- Migration 053: Manual bank-transfer settlement
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- Adds an off-Stripe settlement rail. A client may pay by bank transfer
-- directly to us; an admin then confirms funds received (the equivalent of the
-- payment_intent.succeeded webhook) and later records the manual payout to the
-- worker (the equivalent of fireTransfer). The internal state machine is
-- unchanged — the same transactions row + job status drive every participant's
-- view, so no parallel UI is needed. In manual mode we are the escrow: funds
-- sit with us between 'held' and 'released'.
-- ============================================================

-- 1. transactions: record the rail + manual payout metadata.
alter table public.transactions
  add column if not exists payment_method text not null default 'card'
    check (payment_method in ('card', 'bank_transfer')),
  add column if not exists payout_method text
    check (payout_method is null or payout_method in ('stripe', 'manual')),
  add column if not exists manual_payout_reference text,
  add column if not exists confirmed_by uuid references public.profiles(id);

-- 2. payment_attempts: allow a non-Stripe (bank transfer) attempt.
alter table public.payment_attempts
  add column if not exists method text not null default 'card'
    check (method in ('card', 'bank_transfer'));

-- A bank-transfer attempt has no PaymentIntent, so the id may be null.
alter table public.payment_attempts
  alter column stripe_payment_intent_id drop not null;

-- 3. finalize_manual_payment(attempt_id): the "funds received" trigger.
--    Mirrors finalize_payment_attempt (migration 033) but is keyed on the
--    attempt id and writes a bank_transfer transaction with no PaymentIntent.
--    Same row locks, same authorisation, same applicant/direct-request advance.
create or replace function public.finalize_manual_payment(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt    public.payment_attempts%rowtype;
  v_job        public.jobs%rowtype;
  v_existing   public.transactions%rowtype;
  v_authorised boolean;
  v_reserved   uuid;
  v_accepted   uuid;
begin
  -- 1. Lock the attempt.
  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('result', 'attempt_not_found', 'attempt', null);
  end if;

  if v_attempt.method <> 'bank_transfer' then
    return jsonb_build_object(
      'result', 'not_manual', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- Idempotent for repeated admin confirmations.
  if v_attempt.status <> 'pending' then
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 2. Lock the job, serialising all finalizations for this job.
  select * into v_job from public.jobs where id = v_attempt.job_id for update;
  if not found then
    return jsonb_build_object(
      'result', 'job_not_found', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 3. Idempotency: a transaction may already exist for this job.
  select * into v_existing
  from public.transactions
  where job_id = v_attempt.job_id;

  if found then
    update public.payment_attempts
    set status = 'succeeded', updated_at = now()
    where id = v_attempt.id;
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 4. Authorise the payer. Personal job: payer must be the owner.
  --    Organisation job: payer must be a current member (mirrors 033).
  if v_job.organisation_id is null then
    v_authorised := (v_job.client_id = v_attempt.client_id);
  else
    v_authorised := exists (
      select 1
      from public.organisation_members m
      join public.organisations o on o.id = m.organisation_id
      where m.organisation_id = v_job.organisation_id
        and m.user_id = v_attempt.client_id
        and o.deleted_at is null
    );
  end if;

  if not v_authorised then
    return jsonb_build_object(
      'result', 'unauthorised', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 5. Advance job/applications for the winning worker (mirrors 033).
  if v_attempt.attempt_type = 'application' then
    if v_attempt.application_id is null then
      return jsonb_build_object(
        'result', 'application_missing_id', 'attempt', to_jsonb(v_attempt)
      );
    end if;

    if v_job.status = 'open' then
      update public.jobs
      set status = 'in_progress', kinglancer_id = v_attempt.kinglancer_id
      where id = v_job.id
        and status = 'open'
        and kinglancer_id is null
      returning id into v_reserved;

      if v_reserved is null then
        return jsonb_build_object(
          'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.applications
      set status = 'accepted'
      where id = v_attempt.application_id
        and job_id = v_job.id
        and status = 'pending'
      returning id into v_accepted;

      if v_accepted is null then
        return jsonb_build_object(
          'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.applications
      set status = 'rejected'
      where job_id = v_job.id
        and id <> v_attempt.application_id
        and status = 'pending';

    elsif v_job.status <> 'in_progress'
          or v_job.kinglancer_id is distinct from v_attempt.kinglancer_id then
      return jsonb_build_object(
        'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
      );
    end if;

  else
    -- Direct request.
    if v_job.status = 'open' then
      if v_job.invited_kinglancer_id is distinct from v_attempt.kinglancer_id
         or v_job.direct_request_status <> 'accepted_pending_payment' then
        return jsonb_build_object(
          'result', 'direct_not_ready', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.jobs
      set status = 'in_progress',
          kinglancer_id = v_attempt.kinglancer_id,
          direct_request_status = null
      where id = v_job.id
        and status = 'open'
        and direct_request_status = 'accepted_pending_payment'
        and invited_kinglancer_id = v_attempt.kinglancer_id
      returning id into v_reserved;

      if v_reserved is null then
        return jsonb_build_object(
          'result', 'direct_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

    elsif v_job.status <> 'in_progress'
          or v_job.kinglancer_id is distinct from v_attempt.kinglancer_id then
      return jsonb_build_object(
        'result', 'direct_changed', 'attempt', to_jsonb(v_attempt)
      );
    end if;
  end if;

  -- 6. Insert the held escrow transaction (bank_transfer, no PaymentIntent).
  insert into public.transactions (
    job_id, application_id, client_id, kinglancer_id, amount,
    platform_fee_client, platform_fee_kinglancer, payment_method, status
  ) values (
    v_attempt.job_id, v_attempt.application_id, v_attempt.client_id,
    v_attempt.kinglancer_id, v_attempt.amount, v_attempt.platform_fee_client,
    v_attempt.platform_fee_kinglancer, 'bank_transfer', 'held'
  );

  update public.payment_attempts
  set status = 'succeeded', updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object(
    'result', 'finalized', 'attempt', to_jsonb(v_attempt)
  );

exception
  when unique_violation then
    -- A concurrent finalization already inserted the transaction. Idempotent.
    update public.payment_attempts
    set status = 'succeeded', updated_at = now()
    where id = v_attempt.id;
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
end;
$$;

-- Only the service role (admin settlement routes) may finalize manual payments.
revoke execute on function public.finalize_manual_payment(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_manual_payment(uuid)
  to service_role;
-- ============================================================
-- Migration 054: Kinglancer payout methods (manual payouts)
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- Workers are paid by hand on the manual rail, so we need where to send the
-- money. To minimise sensitive personal data (GDPR), we store a
-- worker-controlled PAYOUT LINK / handle (PayPal.me, Wise, Monzo.me,
-- Revolut.me) rather than raw bank numbers — lower sensitivity and portable.
-- Still private: kept off `profiles` (publicly readable), owner-only read, all
-- writes through the service role. The admin reads it at payout time.
-- ============================================================

create table public.payout_accounts (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  payout_provider text not null
    check (payout_provider in ('paypal', 'wise', 'monzo', 'revolut', 'other')),
  payout_link     text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger on_payout_accounts_updated
  before update on public.payout_accounts
  for each row execute function public.handle_updated_at();

alter table public.payout_accounts enable row level security;

-- Owner-only read; no public policy. Writes are service-role only (bypasses
-- RLS) via the validated server route.
create policy "Users read own payout account"
  on public.payout_accounts
  for select using (auth.uid() = user_id);
-- ============================================================
-- Migration 055: Client "I've made the transfer" signal
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- On the manual bank-transfer rail the admin verifies funds against the bank.
-- This flag lets the client tell us they've sent the money, so the admin can
-- tell "not paid yet" from "client says paid — go check". Additive, nullable.
-- ============================================================

alter table public.payment_attempts
  add column if not exists client_marked_paid_at timestamptz;
-- ============================================================
-- Migration 056: User subscriptions (client & kinglancer)
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- One flat monthly subscription per user, keyed on the profile. A profile is
-- exactly one role at a time (client OR kinglancer — `both` was removed in
-- migration 004), so a single row per user is enough; `role`/`plan` record
-- which subscription it is.
--
--   • Client subscription  → unlocks paying for jobs by CARD below the
--     card-without-subscription threshold (Stripe fees erode small-job margin).
--   • Kinglancer subscription → unlocks automated Stripe payouts (their fee
--     covers Stripe's £2/month active-account cost) + applying to small jobs.
--
-- Organisation subscriptions stay in their own table (tiered, entitlement-rich,
-- plan-switching). Writes here are service-role only; the owner reads their own.
-- ============================================================

create table public.user_subscriptions (
  user_id                     uuid primary key
    references public.profiles(id) on delete cascade,
  role                        text not null check (role in ('client', 'kinglancer')),
  plan                        text not null,
  status                      text not null check (status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  stripe_customer_id          text not null,
  stripe_subscription_id      text not null unique,
  stripe_price_id             text not null,
  cancel_at_period_end        boolean not null default false,
  current_period_end          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index user_subscriptions_customer_idx
  on public.user_subscriptions (stripe_customer_id);

create trigger on_user_subscriptions_updated
  before update on public.user_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.user_subscriptions enable row level security;

-- Owner-only read; no public policy. All writes go through the service role
-- (bypasses RLS) from the validated server routes / Stripe webhook.
create policy "Users read own subscription"
  on public.user_subscriptions
  for select using (auth.uid() = user_id);

grant select on public.user_subscriptions to authenticated;
grant select, insert, update, delete on public.user_subscriptions to service_role;

commit;

-- Reload PostgREST so new functions/columns/policies are visible
notify pgrst, 'reload schema';
