-- Cookie-client subscription reads evaluate an RLS policy that queries
-- organisation_members. That table previously had neither an authenticated
-- SELECT grant nor a read policy, causing the job posting page to return 500.
-- Expose only the caller's own membership rows; keep writes service-only.
begin;

grant select on public.organisation_members to authenticated;

drop policy if exists "Users read own organisation memberships"
  on public.organisation_members;
create policy "Users read own organisation memberships"
  on public.organisation_members
  for select to authenticated
  using (user_id = (select auth.uid()));

commit;
