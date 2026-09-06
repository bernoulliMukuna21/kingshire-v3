-- ============================================================
-- 050 — Per-side archive (hide) for placements & agreements
-- Lets an org hide a wound-down placement from its own lists, and a Kinglancer
-- hide a finished agreement from theirs, without affecting the other party or
-- deleting shared history. Additive/backward-compatible.
-- ============================================================

alter table public.placements
  add column if not exists archived_at timestamptz;

alter table public.placement_agreements
  add column if not exists kinglancer_archived_at timestamptz;
