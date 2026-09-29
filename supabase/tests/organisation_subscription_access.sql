-- Regression for the job-attachment entitlement query. Run against staging:
-- supabase db query --linked --file supabase/tests/organisation_subscription_access.sql
-- Read-only checks in a rolled-back transaction; no user records are changed.
begin;

-- Choose an existing member with a subscription to avoid a vacuous success.
do $$
declare
  actor uuid;
  expected integer;
begin
  select m.user_id into actor
  from public.organisation_members m
  join public.organisation_subscriptions s using (organisation_id)
  limit 1;
  if actor is null then
    raise exception 'Test requires an Organisation member with a subscription';
  end if;
  select count(*) into expected
  from public.organisation_subscriptions s
  where exists (
    select 1 from public.organisation_members m
    where m.organisation_id = s.organisation_id and m.user_id = actor
  );
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('test.expected_subscriptions', expected::text, true);
end;
$$;

set local role authenticated;
do $$
declare
  actual integer;
begin
  if exists (select 1 from public.organisation_members where user_id <> auth.uid()) then
    raise exception 'Membership rows leaked across users';
  end if;
  -- Execute the same columns queried by getJobAttachmentOrganisationIds.
  select count(*) into actual from (
    select organisation_id, status from public.organisation_subscriptions
  ) visible;
  if actual <> current_setting('test.expected_subscriptions')::integer then
    raise exception 'Expected own subscriptions, got %', actual;
  end if;
  if exists (
    select 1 from public.organisation_subscriptions s
    where not exists (
      select 1 from public.organisation_members m
      where m.organisation_id = s.organisation_id and m.user_id = auth.uid()
    )
  ) then
    raise exception 'Subscription rows leaked across organisations';
  end if;
  if has_table_privilege('authenticated', 'public.organisation_members', 'INSERT')
     or has_table_privilege('authenticated', 'public.organisation_members', 'UPDATE')
     or has_table_privilege('authenticated', 'public.organisation_members', 'DELETE') then
    raise exception 'Authenticated role must not have membership write privileges';
  end if;
end;
$$;

-- An identity with no memberships must receive empty results, not a 500.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.organisation_members)
     or exists (select 1 from public.organisation_subscriptions) then
    raise exception 'Non-member can read memberships or subscriptions';
  end if;
end;
$$;
rollback;
select 'PASS: member reads, tenant isolation, non-member reads, and no membership writes' as result;
