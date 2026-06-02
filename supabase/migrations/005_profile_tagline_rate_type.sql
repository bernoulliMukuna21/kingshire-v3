-- Add professional tagline and rate_type to kinglancer profiles

alter table public.profiles
  add column if not exists tagline   text,
  add column if not exists rate_type text default 'per_hour'
    check (rate_type in ('per_hour', 'per_day', 'per_project'));
