-- ============================================================
-- PRODUCTION migration verification
-- Run this in Supabase → SQL Editor on the PRODUCTION project.
-- Read-only: it changes nothing. It reports which migration
-- (032–056) is already applied, based on a signature object per
-- migration (a table, column, function or storage bucket the
-- migration introduces).
--
-- Interpret the output:
--   present = true   → migration already applied, SKIP it
--   present = false  → migration NOT applied, APPLY it (in order)
--
-- Migrations whose only effect is replacing a function body,
-- loosening a CHECK constraint, or (re)granting are marked
-- kind = 're-run' below: existence can't prove the LATEST version
-- is in place, so re-run them regardless — they are idempotent
-- (create or replace / drop constraint if exists + add / grant).
-- ============================================================

with expected(migration, kind, ident) as (
  values
    ('032', 're-run',   'get_client_stats'),               -- secure function grants (fn body)
    ('033', 'function', 'finalize_payment_attempt'),        -- atomic payment finalization
    ('034', 'table',    'placements'),                      -- placements foundation (+ 5 tables)
    ('034', 'column',   'profiles.open_to_placements'),
    ('035', 'column',   'jobs.work_mode'),                  -- job work mode
    ('036', 'column',   'placements.days_on_site'),         -- placement work mode + comp
    ('037', 're-run',   'jobs'),                            -- job hybrid work mode (CHECK loosen)
    ('038', 'column',   'jobs.ends_at'),                    -- job attendance end
    ('039', 'column',   'placements.end_date'),             -- placement dates
    ('040', 'column',   'placements.compensation_details'), -- compensation details (jsonb)
    ('041', 'column',   'placement_applications.cv_url'),   -- placement CV
    ('041', 'bucket',   'placement-cvs'),                   --   + storage bucket + policies
    ('042', 'column',   'placements.payment_mode'),         -- placement payment mode
    ('043', 'table',    'placement_payments'),              -- placement payments
    ('043', 'column',   'placement_agreements.payment_mode'),
    ('044', 'column',   'experience_records.verification_status'), -- verified experience
    ('045', 're-run',   'placements'),                      -- weekly hours cap 16→20 (CHECK)
    ('046', 're-run',   'placement_payments'),              -- placement_payments grants
    ('047', 'column',   'placement_payments.notice_sent_at'),     -- escrow model
    ('048', 'column',   'placement_agreements.end_requested_by'), -- early end
    ('049', 're-run',   'placement_agreements'),            -- pending_funding status (CHECK)
    ('050', 'column',   'placements.archived_at'),          -- placement archive
    ('051', 'column',   'profiles.terms_accepted_version'), -- terms consent
    ('052', 're-run',   'get_client_stats'),               -- personal-scope stats (fn body)
    ('053', 'column',   'transactions.payment_method'),     -- manual bank transfer settlement
    ('053', 'function', 'finalize_manual_payment'),
    ('054', 'table',    'payout_accounts'),                 -- payout accounts
    ('055', 'column',   'payment_attempts.client_marked_paid_at'), -- client marked paid
    ('056', 'table',    'user_subscriptions')              -- user subscriptions
)
select
  migration,
  kind,
  ident,
  case kind
    when 'table' then exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ident
    )
    when 'column' then exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name  = split_part(ident, '.', 1)
        and column_name = split_part(ident, '.', 2)
    )
    when 'function' then exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = ident
    )
    when 'bucket' then exists (
      select 1 from storage.buckets where id = ident
    )
    when 're-run' then true  -- idempotent; re-run regardless (see header)
  end as present,
  case kind when 're-run' then 'idempotent — re-run to guarantee latest version'
            else 'apply if present = false' end as action
from expected
order by migration, kind, ident;

-- After applying any missing migrations, reload the PostgREST schema cache:
--   notify pgrst, 'reload schema';
