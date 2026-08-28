-- 052 — Scope client stats to PERSONAL jobs only.
-- A client who belongs to an organisation can post both personal jobs
-- (organisation_id IS NULL) and org-owned jobs. The personal dashboard must
-- count/spend only PERSONAL jobs; org jobs belong to the org workspace.
-- Mirrors the read-side invariant: personal scope = client_id AND organisation_id IS NULL.

create or replace function public.get_client_stats(p_client_id uuid)
returns table(
  total_spent      numeric,
  total_jobs       bigint,
  open_jobs        bigint,
  completed_jobs   bigint,
  total_applicants bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_client_id then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select
      coalesce(
        (select sum(t.amount + t.platform_fee_client)
         from   transactions t
         join   jobs j on j.id = t.job_id
         where  t.client_id = p_client_id
           and  t.status in ('held', 'released')
           and  j.organisation_id is null),
        0
      ) as total_spent,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null)                       as total_jobs,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null and status = 'open')   as open_jobs,
      (select count(*) from jobs
        where client_id = p_client_id and organisation_id is null and status = 'approved') as completed_jobs,
      (select count(*)
       from   applications a
       join   jobs j on j.id = a.job_id
       where  j.client_id = p_client_id and j.organisation_id is null)                   as total_applicants;
end;
$$;
