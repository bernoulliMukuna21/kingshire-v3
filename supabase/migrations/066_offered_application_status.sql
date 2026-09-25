-- ============================================================
-- 066 — "offered" application status
-- An org selecting an applicant is an OFFER, not a hire: the Kinglancer must
-- still accept before anything starts. 'offered' distinguishes "org acted,
-- waiting on the Kinglancer" from 'pending' ("org hasn't reviewed yet"), so
-- "needs your review" counts don't re-surface an applicant the org already
-- selected. Shared status values across jobs and placements — one hiring
-- lifecycle, not two.
-- ============================================================

alter table public.applications
  drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'offered', 'accepted', 'rejected'));

alter table public.placement_applications
  drop constraint if exists placement_applications_status_check;
alter table public.placement_applications
  add constraint placement_applications_status_check
  check (status in ('pending', 'offered', 'accepted', 'rejected', 'withdrawn'));
