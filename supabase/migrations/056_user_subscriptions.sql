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
