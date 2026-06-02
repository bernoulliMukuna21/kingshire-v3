-- ============================================================
-- Migration 014: Security hardening
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Drop the transaction update policy added in migration 010.
--    All transaction writes now go through the service role (webhooks,
--    cron, server routes) which bypasses RLS. No client-side actor
--    should be able to flip a transaction status directly.
drop policy if exists "Parties can update own transactions" on public.transactions;

-- 2. Remove the kinglancer jobs update policy.
--    complete/dispute routes now use the service client, so this
--    RLS policy is no longer needed and was a direct manipulation vector.
drop policy if exists "Kinglancers can update assigned jobs" on public.jobs;

-- 3. Tighten the client jobs update policy.
--    Clients may only edit their own jobs while the job is still open
--    (before a kinglancer is selected). All status transitions are handled
--    server-side via the service role.
drop policy if exists "Clients can update own jobs" on public.jobs;
create policy "Clients can update own jobs" on public.jobs
  for update using (auth.uid() = client_id)
  with check (auth.uid() = client_id AND status = 'open');

-- 4. Add a trigger to protect system-managed profile fields.
--    When an authenticated user updates their profile, these columns
--    are silently reverted to their current values. Service role writes
--    (e.g. from webhooks) are not affected.
create or replace function public.restrict_profile_update()
returns trigger language plpgsql security definer as $$
declare
  jwt_role text;
begin
  begin
    jwt_role := (current_setting('request.jwt.claims', true)::jsonb)->>'role';
  exception when others then
    jwt_role := null;
  end;

  if jwt_role = 'authenticated' then
    new.role                       := old.role;
    new.rating                     := old.rating;
    new.jobs_completed             := old.jobs_completed;
    new.is_verified                := old.is_verified;
    new.stripe_account_id          := old.stripe_account_id;
    new.stripe_onboarding_complete := old.stripe_onboarding_complete;
  end if;
  return new;
end;
$$;

-- Drop and recreate to ensure latest version is active
drop trigger if exists on_profile_update_restrict on public.profiles;
create trigger on_profile_update_restrict
  before update on public.profiles
  for each row execute function public.restrict_profile_update();
