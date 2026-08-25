-- ============================================================
-- 046 — Grant privileges on placement_payments
-- Migration 043 created the table + RLS but omitted the table grants that
-- every other placement table has, so the service role hit
-- "permission denied for table placement_payments". Additive/idempotent.
-- ============================================================

grant select on public.placement_payments to authenticated;
grant all on public.placement_payments to service_role;
