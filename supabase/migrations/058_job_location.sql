-- ============================================================
-- Migration 058: Structured job location (address + geocode)
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- In-person / hybrid jobs capture a precise address. Exact address is
-- sensitive, so it's shown only to the owner and (once escrow is funded) the
-- assigned Kinglancer — everyone else sees the public `location_area` only.
-- Geocode (lat/lng) + area are derived server-side from the postcode via the
-- free postcodes.io service. Additive & backward-compatible; legacy jobs keep
-- their free-text `location`.
-- ============================================================

alter table public.jobs
  add column if not exists address_line text,
  add column if not exists postcode text,
  add column if not exists location_area text,
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6);
