-- ============================================================
-- Migration 061: Organisation recurring-role postings
-- Run in Supabase -> SQL Editor (STAGING first, then PROD)
-- ============================================================
-- Existing jobs remain one-off gigs. New role columns are nullable/defaulted so
-- the current personal and Organisation gig flow remains unchanged.

alter table public.jobs
  add column if not exists posting_type text not null default 'gig'
    check (posting_type in ('gig', 'role')),
  add column if not exists employment_type text
    check (employment_type is null or employment_type in ('permanent', 'temporary')),
  add column if not exists pay_cadence text
    check (pay_cadence is null or pay_cadence in ('weekly', 'monthly')),
  add column if not exists pay_amount numeric(10, 2)
    check (pay_amount is null or pay_amount >= 0),
  add column if not exists pay_negotiable boolean not null default false,
  add column if not exists settlement_mode text
    check (settlement_mode is null or settlement_mode in ('managed', 'direct'));

alter table public.jobs
  add constraint organisation_role_fields_check
  check (
    posting_type = 'gig'
    or organisation_id is not null
  ),
  add constraint organisation_role_employment_check
  check (
    posting_type = 'gig'
    or employment_type is not null
  ),
  add constraint organisation_role_pay_check
  check (
    posting_type = 'gig'
    or (
      pay_negotiable = true
      or (pay_amount is not null and pay_amount > 0 and pay_cadence is not null)
    )
  ),
  add constraint organisation_role_settlement_check
  check (
    posting_type = 'gig'
    or settlement_mode is not null
  );

create index if not exists jobs_organisation_role_idx
  on public.jobs (organisation_id, posting_type, status, created_at desc)
  where organisation_id is not null;
