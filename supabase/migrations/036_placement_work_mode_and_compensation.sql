-- ============================================================
-- Migration 036: Placement work mode + compensation
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive & backward-compatible:
--   * work_mode replaces the boolean is_remote (kept in sync by the app for
--     now); existing rows default to 'remote' and are then reclassified.
--   * days_on_site applies to hybrid placements only.
--   * compensation_types is an optional multi-select; compensation_note holds
--     the explanation required when 'other' is chosen.
-- ============================================================

alter table public.placements
  add column if not exists work_mode text not null default 'remote'
    check (work_mode in ('remote', 'hybrid', 'onsite')),
  add column if not exists days_on_site int
    check (days_on_site between 1 and 6),
  add column if not exists compensation_types text[] not null default '{}',
  add column if not exists compensation_note text;

-- Reclassify any pre-existing rows from the legacy is_remote flag.
update public.placements
  set work_mode = case when is_remote then 'remote' else 'onsite' end;
