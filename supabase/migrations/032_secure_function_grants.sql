-- ============================================================
-- Migration 032: Secure SECURITY DEFINER function grants (audit C1)
-- Run this in Supabase → SQL Editor (STAGING + PROD)
-- ============================================================
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. Several privileged
-- SECURITY DEFINER functions were created without revoking that access,
-- so any caller (incl. anon / authenticated) could invoke them directly:
--
--   * get_client_stats / get_kinglancer_stats  — could disclose ANOTHER
--     user's financial aggregates by passing their id.
--   * increment_jobs_completed                 — could forge completion counts.
--   * recompute_profile_rating                 — could force rating recompute.
--   * reveal_expired_reviews                   — could trigger review publication.
--
-- This migration:
--   1. Recreates the two user-facing stats functions so they authorise the
--      caller internally (auth.uid() must equal the requested id) and pins a
--      safe search_path. Dashboards keep working; cross-user reads are denied.
--   2. Revokes EXECUTE from public/anon/authenticated on the service-role /
--      trigger-only functions and grants it to service_role, pinning
--      search_path where missing.
--
-- Trigger-invoked functions (recompute_profile_rating via on_review_* ) still
-- run because SECURITY DEFINER trigger execution does not require the caller
-- to hold EXECUTE on the invoked function.
--
-- NOTE: also run the inventory query from docs/TECHNICAL_AUDIT_2026-07-25.md
-- (C1) against staging + production to confirm no other function still grants
-- unintended execution.
-- ============================================================

-- ── 1. User-facing stats: authorise the caller internally ──

create or replace function public.get_client_stats(p_client_id uuid)
returns table(
  total_spent      numeric,
  total_jobs       bigint,
  open_jobs        bigint,
  completed_jobs   bigint,
  total_applicants bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  -- A caller may only read their own aggregates. auth.uid() is null for anon
  -- and service contexts, and `is distinct from` treats that as unauthorised.
  if auth.uid() is distinct from p_client_id then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select
      coalesce(
        (select sum(amount + platform_fee_client)
         from   transactions
         where  client_id = p_client_id
           and  status in ('held', 'released')),
        0
      ) as total_spent,
      (select count(*) from jobs where client_id = p_client_id)                         as total_jobs,
      (select count(*) from jobs where client_id = p_client_id and status = 'open')     as open_jobs,
      (select count(*) from jobs where client_id = p_client_id and status = 'approved') as completed_jobs,
      (select count(*)
       from   applications a
       join   jobs j on j.id = a.job_id
       where  j.client_id = p_client_id)                                                as total_applicants;
end;
$$;

create or replace function public.get_kinglancer_stats(p_kinglancer_id uuid)
returns table(
  total_earned numeric,
  total_held   numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_kinglancer_id then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select
      coalesce(sum(case when status = 'released' then amount - platform_fee_kinglancer else 0 end), 0) as total_earned,
      coalesce(sum(case when status = 'held'     then amount - platform_fee_kinglancer else 0 end), 0) as total_held
    from transactions
    where kinglancer_id = p_kinglancer_id;
end;
$$;

-- Dashboards call these as the authenticated user; anon has no business here.
revoke execute on function public.get_client_stats(uuid) from public, anon;
revoke execute on function public.get_kinglancer_stats(uuid) from public, anon;
grant execute on function public.get_client_stats(uuid) to authenticated, service_role;
grant execute on function public.get_kinglancer_stats(uuid) to authenticated, service_role;

-- ── 2. Service-role / trigger-only functions ──────────────

alter function public.increment_jobs_completed(uuid) set search_path = public;
revoke execute on function public.increment_jobs_completed(uuid) from public, anon, authenticated;
grant  execute on function public.increment_jobs_completed(uuid) to service_role;

revoke execute on function public.recompute_profile_rating(uuid) from public, anon, authenticated;
grant  execute on function public.recompute_profile_rating(uuid) to service_role;

revoke execute on function public.reveal_expired_reviews() from public, anon, authenticated;
grant  execute on function public.reveal_expired_reviews() to service_role;
