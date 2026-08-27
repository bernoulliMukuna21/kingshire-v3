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
