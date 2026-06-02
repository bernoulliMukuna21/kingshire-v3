-- Replace single-value `category text` with `categories text[]` so clients
-- can tag a job with multiple service types.
-- skills_required is intentionally kept in the DB but removed from the form
-- (categories cover the same ground for this platform).

alter table public.jobs rename column category to categories;

alter table public.jobs
  alter column categories type text[]
  using case when categories = '' then '{}' else array[categories] end;

alter table public.jobs
  alter column categories set default '{}';
