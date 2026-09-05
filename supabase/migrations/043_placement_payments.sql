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
