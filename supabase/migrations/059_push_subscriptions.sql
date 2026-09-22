-- ============================================================
-- Migration 059: Web push subscriptions
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- One row per subscribed BROWSER/DEVICE (a user can have several — phone home
-- screen + desktop browser), keyed by the push endpoint the browser gives us.
-- Writes are service-role only (via validated server routes); the owner can
-- read/delete their own rows (e.g. a future "manage devices" UI).
-- ============================================================

create table public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users read own push subscriptions"
  on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users delete own push subscriptions"
  on public.push_subscriptions
  for delete using (auth.uid() = user_id);
