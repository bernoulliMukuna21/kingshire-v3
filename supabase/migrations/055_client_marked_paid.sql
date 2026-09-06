-- ============================================================
-- Migration 055: Client "I've made the transfer" signal
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- On the manual bank-transfer rail the admin verifies funds against the bank.
-- This flag lets the client tell us they've sent the money, so the admin can
-- tell "not paid yet" from "client says paid — go check". Additive, nullable.
-- ============================================================

alter table public.payment_attempts
  add column if not exists client_marked_paid_at timestamptz;
