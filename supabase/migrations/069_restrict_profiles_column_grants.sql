-- ============================================================
-- SECURITY FIX: profiles table over-exposes sensitive columns
-- ============================================================
-- `grant select on all tables in schema public to anon;` (schema.sql) plus
-- the "Profiles are viewable by everyone" RLS policy (using (true)) means
-- ANY unauthenticated request, and any signed-up `authenticated` user, can
-- currently read every column of every profile row via the PostgREST API —
-- including email, phone, cv_url, stripe_account_id and
-- stripe_onboarding_complete.
--
-- Row-visibility (the "everyone can find a profile by id" policy) is left
-- alone — public browsing (kinglancer directory, job posters, etc.) needs
-- that. What we restrict here is COLUMNS: anon/authenticated may only ever
-- select the public-facing fields. Sensitive columns become readable only
-- via the service-role client (already the established pattern for
-- privileged/cross-user reads in this codebase).
--
-- Postgres column grants are per-role, not per-row, so this can't
-- distinguish "my own email" from "someone else's email" for authenticated
-- users — the one legitimate self-read (the profile edit page, which
-- already scopes by auth.uid()) is switched to the service-role client in
-- the same change that ships this migration.

revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  full_name,
  avatar_url,
  role,
  bio,
  service_tags,
  location,
  hourly_rate,
  rate_type,
  tagline,
  services,
  rating,
  total_reviews,
  jobs_completed,
  is_verified,
  portfolio_url,
  open_to_placements,
  created_at
) on public.profiles to anon, authenticated;

-- Sensitive columns (email, phone, cv_url, stripe_account_id,
-- stripe_onboarding_complete, updated_at, terms_accepted_version,
-- terms_accepted_at) are NOT granted to anon/authenticated. Reads of these
-- must go through createServiceClient().
