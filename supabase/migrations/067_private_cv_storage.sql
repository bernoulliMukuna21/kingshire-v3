-- Phase 1: additive CV compatibility and backfill. Apply before deploying code.
-- Keep bucket visibility unchanged until every server uses signed URLs.
begin;
alter table public.applications add column if not exists cv_path text;
alter table public.applications add column if not exists cv_url text;
alter table public.placement_applications add column if not exists cv_path text;
alter table public.placement_applications add column if not exists cv_url text;

-- Also repair installations that ran the earlier rename-only migration.
update public.applications set cv_path = regexp_replace(coalesce(cv_path, cv_url),
  '^https://[^/]+/storage/v1/object/public/job-application-cvs/', '')
where coalesce(cv_path, cv_url) ~ ('^https://[^/]+/storage/v1/object/public/job-application-cvs/' || kinglancer_id::text || '/[^?#]+$');
update public.placement_applications set cv_path = regexp_replace(coalesce(cv_path, cv_url),
  '^https://[^/]+/storage/v1/object/public/placement-cvs/', '')
where coalesce(cv_path, cv_url) ~ ('^https://[^/]+/storage/v1/object/public/placement-cvs/' || kinglancer_id::text || '/[^?#]+$');

drop policy if exists "Users can view their own placement CV" on storage.objects;
create policy "Users can view their own placement CV" on storage.objects for select using (
  bucket_id = 'placement-cvs' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can view their own job application CV" on storage.objects;
create policy "Users can view their own job application CV" on storage.objects for select using (
  bucket_id = 'job-application-cvs' and auth.uid()::text = (storage.foldername(name))[1]);
commit;
