-- Phase 2: run ONLY after all application servers use the signed-CV release.
-- Re-run migration 067 first to backfill uploads made during the rolling deploy.
begin;
update storage.buckets set public = false
where id in ('placement-cvs', 'job-application-cvs');
drop policy if exists "Placement CVs are publicly accessible" on storage.objects;
drop policy if exists "Job application CVs are publicly accessible" on storage.objects;
commit;
