-- ============================================================
-- 065 — CV attachments on job applications
-- Mirrors migration 041 (placement application CVs). Additive/backward-
-- compatible: nullable column + dedicated storage bucket.
-- ============================================================

alter table public.applications
  add column if not exists cv_url text;

-- Public bucket for applicant CVs (unguessable per-user paths).
insert into storage.buckets (id, name, public)
values ('job-application-cvs', 'job-application-cvs', true)
on conflict (id) do nothing;

drop policy if exists "Job application CVs are publicly accessible" on storage.objects;
create policy "Job application CVs are publicly accessible" on storage.objects
  for select using (bucket_id = 'job-application-cvs');

drop policy if exists "Users can upload their own job application CV" on storage.objects;
create policy "Users can upload their own job application CV" on storage.objects
  for insert with check (
    bucket_id = 'job-application-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own job application CV" on storage.objects;
create policy "Users can update their own job application CV" on storage.objects
  for update using (
    bucket_id = 'job-application-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
