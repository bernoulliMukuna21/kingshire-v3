-- ============================================================
-- Prevent duplicate experience records for the same completion
-- ============================================================
-- app/api/placements/agreements/[agreementId]/complete/route.ts is
-- resumable (completeAgreement can succeed while createExperienceRecord
-- fails, and a retry re-attempts just the record write) but had no DB-level
-- guard against two concurrent completions creating two passport records
-- for the same agreement. A partial unique index closes that at the source;
-- application code additionally treats the resulting unique_violation as
-- "already completed" rather than an error.
create unique index if not exists experience_records_agreement_unique_idx
  on public.experience_records (agreement_id)
  where agreement_id is not null;
