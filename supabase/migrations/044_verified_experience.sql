-- ============================================================
-- 044 — Verified experience: admin approval + category scoping
-- A completed placement creates a PENDING experience record; it only becomes
-- a visible "verified" badge after an admin approves it. Additive.
-- ============================================================

alter table public.experience_records
  add column if not exists categories text[] not null default '{}';
alter table public.experience_records
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected'));
alter table public.experience_records
  add column if not exists verified_at timestamptz;
alter table public.experience_records
  add column if not exists verified_by uuid references public.profiles(id);

-- Admin review queue lookup.
create index if not exists experience_records_pending_idx
  on public.experience_records (created_at desc)
  where verification_status = 'pending';
