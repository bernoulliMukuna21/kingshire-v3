-- ============================================================
-- 060 — Grant privileges on push_subscriptions
-- Migration 059 created the table + RLS but omitted the table grants
-- (same class of bug as 043→046 for placement_payments), so the service
-- role hit "permission denied for table push_subscriptions". Additive/
-- idempotent.
-- ============================================================

grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
