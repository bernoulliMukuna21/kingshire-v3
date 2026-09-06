-- ============================================================
-- 049 — Placement agreement 'pending_funding' state
-- After the Kinglancer accepts a managed placement, the agreement waits in
-- 'pending_funding' until the organisation explicitly funds the first month.
-- Funding month 1 activates it. Additive/backward-compatible.
-- ============================================================

alter table public.placement_agreements
  drop constraint if exists placement_agreements_status_check;

alter table public.placement_agreements
  add constraint placement_agreements_status_check
    check (status in (
      'pending_acceptance',
      'pending_funding',
      'active',
      'completed',
      'cancelled'
    ));
