-- ============================================================
-- 048 — Mutual early end of a placement agreement
-- Either party can propose ending an active placement early; it only ends
-- once the other party confirms. Additive/backward-compatible.
-- ============================================================

alter table public.placement_agreements
  add column if not exists end_requested_by uuid
    references public.profiles(id) on delete set null;
alter table public.placement_agreements
  add column if not exists end_requested_at timestamptz;
alter table public.placement_agreements
  add column if not exists end_reason text;
