-- ============================================================
-- 041 — CV attachments on placement applications
-- Additive/backward-compatible: nullable column + storage bucket.
-- ============================================================

alter table public.placement_applications
  add column if not exists cv_url text;

-- Public bucket for applicant CVs (unguessable per-user paths).
insert into storage.buckets (id, name, public)
values ('placement-cvs', 'placement-cvs', true)
on conflict (id) do nothing;

drop policy if exists "Placement CVs are publicly accessible" on storage.objects;
create policy "Placement CVs are publicly accessible" on storage.objects
  for select using (bucket_id = 'placement-cvs');

drop policy if exists "Users can upload their own placement CV" on storage.objects;
create policy "Users can upload their own placement CV" on storage.objects
  for insert with check (
    bucket_id = 'placement-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own placement CV" on storage.objects;
create policy "Users can update their own placement CV" on storage.objects
  for update using (
    bucket_id = 'placement-cvs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
