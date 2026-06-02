-- ============================================================
-- Migration 016: Tighten insert RLS policies
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Tighten the application insert policy so only a profile with
--    role = 'kinglancer' can apply, and only to a job that is 'open'.
--    Previously any authenticated user could insert regardless of their role.
drop policy if exists "Kinglancers can apply" on public.applications;
create policy "Kinglancers can apply" on public.applications
  for insert with check (
    auth.uid() = kinglancer_id
    AND (select role from public.profiles where id = auth.uid()) = 'kinglancer'
    AND (select status from public.jobs where id = job_id) = 'open'
  );

-- 2. Tighten the job insert policy so only a profile with role = 'client'
--    can create jobs. Previously any authenticated user could insert
--    with a matching client_id regardless of their profile role.
drop policy if exists "Clients can create jobs" on public.jobs;
create policy "Clients can create jobs" on public.jobs
  for insert with check (
    auth.uid() = client_id
    AND (select role from public.profiles where id = auth.uid()) = 'client'
  );
