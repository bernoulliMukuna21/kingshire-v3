-- ============================================================
-- 042 — Placement payment mode (managed vs direct)
-- Additive/backward-compatible: nullable-with-default column.
-- 'direct'  = the organisation pays the Kinglancer themselves (record only).
-- 'managed' = KingsHire collects from the organisation and pays the
--             Kinglancer monthly (escrow + payout). Only valid when the
--             placement offers money compensation.
-- ============================================================

alter table public.placements
  add column if not exists payment_mode text not null default 'direct'
    check (payment_mode in ('managed', 'direct'));
