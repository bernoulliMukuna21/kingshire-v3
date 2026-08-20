-- ============================================================
-- 043 — Managed monthly placement payments
-- Additive/backward-compatible. Managed placements are paid monthly:
-- the organisation funds each month into escrow, then it is released to
-- the Kinglancer (minus the platform fee), reusing the jobs fee model.
-- ============================================================

alter table public.placement_agreements
  add column if not exists payment_mode text not null default 'direct'
    check (payment_mode in ('managed', 'direct')),
  add column if not exists monthly_amount numeric(10, 2);

create table if not exists public.placement_payments (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null
    references public.placement_agreements(id) on delete cascade,
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  -- The month this payment covers, e.g. "2026-08".
  period_label text not null,
  -- Gross monthly amount owed to the Kinglancer (before the Kinglancer fee).
  amount numeric(10, 2) not null check (amount > 0),
  platform_fee_client numeric(10, 2) not null default 0,
  platform_fee_kinglancer numeric(10, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'held', 'released', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One payment per month per agreement.
  unique (agreement_id, period_label)
);

create index if not exists placement_payments_agreement_idx
  on public.placement_payments (agreement_id, created_at desc);
create index if not exists placement_payments_kinglancer_idx
  on public.placement_payments (kinglancer_id, status);

alter table public.placement_payments enable row level security;

-- Reads: the participant Kinglancer or any member of the paying organisation.
-- Writes happen through the service role only.
create policy "Read placement payments via agreement"
  on public.placement_payments
  for select using (
    kinglancer_id = auth.uid()
    or exists (
      select 1 from public.organisation_members
      where organisation_id = placement_payments.organisation_id
        and user_id = auth.uid()
    )
  );
