-- Replace the flat skills array + global rate with structured per-service pricing.
-- services stores: [{ name, rate, rate_type }]
-- skills is now derived (synced from service names) so the filter pages still work.

alter table public.profiles
  add column if not exists services jsonb not null default '[]';
