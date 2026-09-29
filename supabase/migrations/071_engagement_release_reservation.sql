-- ============================================================
-- Reserve a payment before contacting Stripe for release/refund
-- ============================================================
-- lib/settlement/payouts.ts previously read a payment, then called
-- stripe.transfers.create, and only afterwards tried to CAS the status —
-- two concurrent requests (an automatic release and an admin refund, or two
-- release attempts) could both read the same un-reserved row and both
-- contact Stripe before either write landed. These columns let a release or
-- refund atomically claim a payment (conditioned on status + no existing
-- transfer + no other attempt in flight) BEFORE the external call, so only
-- one caller ever proceeds. release_attempt_started_at lets a genuinely
-- abandoned reservation (a crashed process) be reclaimed after a timeout —
-- release/refund are single fast Stripe calls, not a multi-step redirect
-- flow, so a short window is enough.
alter table public.engagement_payments
  add column if not exists release_attempt_id uuid,
  add column if not exists release_attempt_started_at timestamptz;
