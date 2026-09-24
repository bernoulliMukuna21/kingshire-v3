-- ============================================================
-- Migration 060: Settlement engine — engagements + engagement_payments
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- A domain-agnostic recurring-settlement engine shared by two domains:
--   * placements  (experience/volunteer, bounded duration)
--   * org_role    (paid recurring organisation roles, open-ended)
-- Each domain creates an `engagement` when a Kinglancer is hired; the engine
-- schedules, charges, escrows and releases per period. It knows nothing about
-- placements or jobs — only payer (org), worker, cadence and amount.
--
-- settlement_mode:
--   managed = platform charges the org each period (amount + client fee),
--             holds in escrow, pays the worker (amount − kinglancer fee).
--   direct  = the worker is paid OFF-platform; the platform charges only a
--             facilitation fee (client + kinglancer fee on the declared amount).
--
-- cadence = 'weekly' | 'monthly'. Billing cadence = release cadence.
-- duration_periods NULL = open-ended (rolling schedule); set = bounded.
-- ============================================================

create table if not exists public.engagements (
  id uuid primary key default uuid_generate_v4(),
  source_kind text not null check (source_kind in ('placement', 'org_role')),
  source_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  settlement_mode text not null check (settlement_mode in ('managed', 'direct')),
  cadence text not null check (cadence in ('weekly', 'monthly')),
  -- Worker pay per period. NULL until agreed (a "discuss at interview" role sets
  -- it at hire). For direct mode this is the declared amount the fee is based on.
  amount_per_period numeric(10, 2)
    check (amount_per_period is null or amount_per_period >= 0),
  -- NULL = open-ended (rolling); a positive integer bounds the schedule.
  duration_periods int
    check (duration_periods is null or duration_periods >= 1),
  status text not null default 'pending_acceptance'
    check (status in (
      'pending_acceptance', 'pending_funding', 'active', 'ended', 'cancelled'
    )),
  org_signed_by uuid references public.profiles(id),
  org_signed_at timestamptz,
  kinglancer_signed_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  end_requested_by uuid references public.profiles(id),
  end_requested_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engagements_org_status_idx
  on public.engagements (organisation_id, status);
create index if not exists engagements_kinglancer_status_idx
  on public.engagements (kinglancer_id, status);
create index if not exists engagements_source_idx
  on public.engagements (source_kind, source_id);

create trigger on_engagements_updated
  before update on public.engagements
  for each row execute function public.handle_updated_at();

alter table public.engagements enable row level security;

-- Participant or an org member may read; writes go through the service role.
create policy "Read engagements as participant or org member"
  on public.engagements
  for select using (
    kinglancer_id = auth.uid()
    or exists (
      select 1 from public.organisation_members
      where organisation_id = engagements.organisation_id
        and user_id = auth.uid()
    )
  );

-- ── ENGAGEMENT PAYMENTS (one row per period) ──────────────
-- managed: org charged worker_amount + platform_fee_client → held → worker
--          receives worker_amount − platform_fee_kinglancer on release.
-- direct:  worker_amount = 0; org charged platform_fee_client +
--          platform_fee_kinglancer (facilitation fee); settles on charge.
create table if not exists public.engagement_payments (
  id uuid primary key default uuid_generate_v4(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  period_index int not null check (period_index >= 1),
  due_date date not null,
  worker_amount numeric(10, 2) not null default 0 check (worker_amount >= 0),
  platform_fee_client numeric(10, 2) not null default 0,
  platform_fee_kinglancer numeric(10, 2) not null default 0,
  status text not null default 'due'
    check (status in (
      'due', 'processing', 'held', 'released',
      'failed', 'cancelled', 'disputed', 'refunded'
    )),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  charged_at timestamptz,
  released_at timestamptz,
  notice_sent_at timestamptz,
  dispute_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, period_index)
);

create index if not exists engagement_payments_engagement_idx
  on public.engagement_payments (engagement_id, period_index);
create index if not exists engagement_payments_status_idx
  on public.engagement_payments (status);

create trigger on_engagement_payments_updated
  before update on public.engagement_payments
  for each row execute function public.handle_updated_at();

alter table public.engagement_payments enable row level security;

create policy "Read engagement payments as participant or org member"
  on public.engagement_payments
  for select using (
    kinglancer_id = auth.uid()
    or exists (
      select 1 from public.organisation_members
      where organisation_id = engagement_payments.organisation_id
        and user_id = auth.uid()
    )
  );

-- Reads for authenticated users (RLS-scoped above); all writes via service role.
grant select on public.engagements to authenticated;
grant all on public.engagements to service_role;
grant select on public.engagement_payments to authenticated;
grant all on public.engagement_payments to service_role;
