-- ============================================================
-- 045 — Raise the placement weekly-hours cap from 16 to 20
-- Supervised part-time placements may now run up to 20h/week.
-- ============================================================

alter table public.placements
  drop constraint if exists placements_weekly_hours_check;
alter table public.placements
  add constraint placements_weekly_hours_check
  check (weekly_hours between 1 and 20);

alter table public.placement_agreements
  drop constraint if exists placement_agreements_weekly_hours_check;
alter table public.placement_agreements
  add constraint placement_agreements_weekly_hours_check
  check (weekly_hours between 1 and 20);
