-- ============================================================
-- 047 — Placement payment escrow: disputes + release notice
-- Managed months are now held in escrow and released at month-end after a
-- notice period, unless the org disputes. Additive/backward-compatible.
-- ============================================================

alter table public.placement_payments
  drop constraint if exists placement_payments_status_check;
alter table public.placement_payments
  add constraint placement_payments_status_check
  check (
    status in (
      'due',
      'processing',
      'held',
      'released',
      'failed',
      'cancelled',
      'disputed',
      'refunded'
    )
  );

-- When the "we're about to release" notice was emailed to the org.
alter table public.placement_payments
  add column if not exists notice_sent_at timestamptz;

-- Why the org disputed this month (for the admin resolving it).
alter table public.placement_payments
  add column if not exists dispute_reason text;
