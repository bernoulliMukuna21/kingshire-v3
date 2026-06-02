-- ============================================================
-- Migration 009: Add new_job notification type
-- ============================================================

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_application',
    'job_awarded',
    'work_submitted',
    'payment_released',
    'dispute_raised',
    'new_job'
  ));
