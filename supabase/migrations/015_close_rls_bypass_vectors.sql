-- ============================================================
-- Migration 015: Close remaining RLS bypass vectors
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Remove the application update policy that allowed clients to write
--    application statuses directly via the browser Supabase client.
--    selectApplicant() now uses the service role, so this policy is
--    unnecessary and a direct manipulation vector.
drop policy if exists "Clients can update application status" on public.applications;

-- 2. Remove the transaction insert policy that allowed clients to create
--    transaction rows directly. createTransaction() uses the service role.
drop policy if exists "Clients can create transactions" on public.transactions;

-- 3. Add uniqueness constraints on transactions to prevent duplicate rows
--    from races or retries.
alter table public.transactions
  add constraint transactions_job_id_unique unique (job_id);

alter table public.transactions
  add constraint transactions_stripe_pi_unique unique (stripe_payment_intent_id);

-- 4. Create the increment_jobs_completed RPC used by the approve route.
--    SECURITY DEFINER bypasses the profile trigger so jobs_completed can
--    be incremented by the service role caller.
create or replace function public.increment_jobs_completed(user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set jobs_completed = coalesce(jobs_completed, 0) + 1
  where id = user_id;
end;
$$;
