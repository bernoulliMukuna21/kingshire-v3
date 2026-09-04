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
