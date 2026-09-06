-- ============================================================
-- Migration 040: Placement compensation details
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Additive. Each selected compensation type carries a clarification:
--   money      -> { amount, cadence }
--   other kinds -> a details string
-- Stored as a JSON map keyed by compensation type. compensation_note is
-- superseded and left in place for backward compatibility.
-- ============================================================

alter table public.placements
  add column if not exists compensation_details jsonb not null default '{}';
