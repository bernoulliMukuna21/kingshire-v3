-- Migration 003: Add rate_type to jobs table
-- Run in Supabase dashboard → SQL Editor

alter table public.jobs
  add column if not exists rate_type text not null default 'fixed'
    check (rate_type in ('fixed', 'per_hour', 'per_day'));
