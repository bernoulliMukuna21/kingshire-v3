-- ============================================================
-- Migration 022: Backfill structured Kinglancer services
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Keep services explicitly array-shaped.
alter table public.profiles
  add constraint profiles_services_is_array
  check (jsonb_typeof(services) = 'array')
  not valid;

alter table public.profiles
  validate constraint profiles_services_is_array;

-- Profiles created before structured service rows existed may only have
-- service_tags. Convert those tags into service rows with a discussable rate.
update public.profiles
set services = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', service_name,
        'rate', 0,
        'rate_type', coalesce(public.profiles.rate_type, 'per_hour')
      )
    ),
    '[]'::jsonb
  )
  from unnest(public.profiles.service_tags) as service_name
  where btrim(service_name) <> ''
)
where role = 'kinglancer'
  and jsonb_array_length(services) = 0
  and cardinality(service_tags) > 0;
