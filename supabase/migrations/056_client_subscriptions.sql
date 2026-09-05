-- ============================================================
-- Migration 056: Client subscriptions (card payment access)
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- A personal Client pays a £10/month subscription to unlock the CARD payment
-- rail (Stripe escrow). Without an active subscription a Client can only fund
-- jobs by bank transfer — Stripe's per-transaction fees erode the margin on
-- pay-as-you-go card payments, so card access is a paid feature.
--
-- Organisation-posted jobs are unaffected: an Organisation already carries its
-- own subscription (organisation_subscriptions), which grants card access.
--
-- Mirrors organisation_subscriptions but keyed on the user (the payer). Writes
-- are service-role only; the owner may read their own billing status.
-- ============================================================

create table public.client_subscriptions (
  user_id                     uuid primary key
    references public.profiles(id) on delete cascade,
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

create index client_subscriptions_customer_idx
  on public.client_subscriptions (stripe_customer_id);

create trigger on_client_subscriptions_updated
  before update on public.client_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.client_subscriptions enable row level security;

-- Owner-only read; no public policy. All writes go through the service role
-- (bypasses RLS) from the validated server routes / Stripe webhook.
create policy "Users read own client subscription"
  on public.client_subscriptions
  for select using (auth.uid() = user_id);

grant select on public.client_subscriptions to authenticated;
grant select, insert, update, delete on public.client_subscriptions to service_role;
