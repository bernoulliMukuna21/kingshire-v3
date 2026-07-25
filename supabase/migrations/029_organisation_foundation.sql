-- Phase 1 organisation workspaces, membership, invitations, and job ownership.

create table public.organisations (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 2 and 120),
  organisation_type text not null default 'other'
    check (organisation_type in (
      'company', 'charity', 'church', 'non_profit',
      'community_group', 'public_body', 'other'
    )),
  description text,
  country text not null default 'United Kingdom',
  location text,
  website text,
  email text not null,
  phone text,
  registration_number text,
  logo_url text,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create unique index organisation_one_owner_idx
  on public.organisation_members (organisation_id)
  where role = 'owner';

create index organisation_members_user_joined_idx
  on public.organisation_members (user_id, joined_at);

create table public.organisation_invitations (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token uuid not null default uuid_generate_v4() unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index organisation_pending_invitation_idx
  on public.organisation_invitations (organisation_id, lower(email))
  where accepted_at is null;

alter table public.jobs
  add column organisation_id uuid references public.organisations(id) on delete restrict,
  add column created_by uuid references public.profiles(id);

update public.jobs set created_by = client_id where created_by is null;

alter table public.jobs alter column created_by set not null;

create index jobs_organisation_status_created_at_idx
  on public.jobs (organisation_id, status, created_at desc)
  where organisation_id is not null;

create index jobs_organisation_created_at_idx
  on public.jobs (organisation_id, created_at desc)
  where organisation_id is not null;

create trigger on_organisations_updated
  before update on public.organisations
  for each row execute function public.handle_updated_at();

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.organisation_invitations enable row level security;

-- Public organisation profiles are deferred. Only members can read Phase 1
-- organisation records.
create policy "Members read organisations" on public.organisations
  for select using (
    exists (
      select 1 from public.organisation_members
      where organisation_id = organisations.id
        and user_id = auth.uid()
    )
  );

create policy "Users read own invitations" on public.organisation_invitations
  for select using (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    or exists (
      select 1 from public.organisation_members
      where organisation_id = organisation_invitations.organisation_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- All writes go through authenticated server routes using the service role.
grant select on public.organisations to authenticated;
grant select on public.organisation_invitations to authenticated;
grant all on public.organisations to service_role;
grant all on public.organisation_members to service_role;
grant all on public.organisation_invitations to service_role;

-- Creation and Owner assignment are one transaction. The service-only function
-- deliberately takes the authenticated actor ID from the server adapter.
create or replace function public.create_organisation_with_owner(
  p_actor_id uuid,
  p_name text,
  p_organisation_type text,
  p_description text,
  p_country text,
  p_location text,
  p_website text,
  p_email text,
  p_registration_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id uuid;
begin
  insert into public.organisations (
    name,
    organisation_type,
    description,
    country,
    location,
    website,
    email,
    registration_number,
    created_by
  )
  values (
    p_name,
    p_organisation_type,
    p_description,
    p_country,
    p_location,
    p_website,
    p_email,
    p_registration_number,
    p_actor_id
  )
  returning id into v_organisation_id;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role
  )
  values (v_organisation_id, p_actor_id, 'owner');

  return v_organisation_id;
end;
$$;

revoke all on function public.create_organisation_with_owner(
  uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_organisation_with_owner(
  uuid, text, text, text, text, text, text, text, text
) to service_role;

-- Acceptance locks and consumes an invitation in the same transaction as the
-- membership insert, making retries safe and preventing partial acceptance.
create or replace function public.accept_organisation_invitation(
  p_token uuid,
  p_actor_id uuid,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.organisation_invitations%rowtype;
begin
  select *
  into v_invitation
  from public.organisation_invitations
  where token = p_token
  for update;

  if not found
    or v_invitation.accepted_at is not null
    or v_invitation.expires_at <= now()
  then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(v_invitation.email) <> lower(p_actor_email) then
    raise exception 'Invitation belongs to another email';
  end if;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role
  )
  values (
    v_invitation.organisation_id,
    p_actor_id,
    v_invitation.role
  )
  on conflict (organisation_id, user_id) do nothing;

  update public.organisation_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organisation_id;
end;
$$;

revoke all on function public.accept_organisation_invitation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_organisation_invitation(uuid, uuid, text)
  to service_role;

create or replace function public.get_organisation_stats(
  p_organisation_id uuid
)
returns table (
  job_count bigint,
  member_count bigint,
  released_spend numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*)
     from public.jobs
     where organisation_id = p_organisation_id),
    (select count(*)
     from public.organisation_members
     where organisation_id = p_organisation_id),
    coalesce((
      select sum(t.amount + t.platform_fee_client)
      from public.transactions t
      join public.jobs j on j.id = t.job_id
      where j.organisation_id = p_organisation_id
        and t.status = 'released'
    ), 0);
$$;

revoke all on function public.get_organisation_stats(uuid)
  from public, anon, authenticated;
grant execute on function public.get_organisation_stats(uuid)
  to service_role;

create or replace function public.delete_organisation_if_allowed(
  p_organisation_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.organisation_members
    where organisation_id = p_organisation_id
      and user_id = p_actor_id
      and role = 'owner'
  ) then
    raise exception 'Only the Owner can delete the Organisation';
  end if;

  if exists (
    select 1
    from public.jobs
    where organisation_id = p_organisation_id
      and status in ('open', 'in_progress', 'completed', 'disputed')
  ) then
    raise exception 'Organisation has active jobs';
  end if;

  update public.organisations
  set deleted_at = now()
  where id = p_organisation_id
    and deleted_at is null;
end;
$$;

revoke all on function public.delete_organisation_if_allowed(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_organisation_if_allowed(uuid, uuid)
  to service_role;

create or replace function public.transfer_organisation_ownership(
  p_organisation_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organisation_members
    where organisation_id = p_organisation_id
      and user_id = p_current_owner_id
      and role = 'owner'
  ) then
    raise exception 'Current owner membership not found';
  end if;
  if not exists (
    select 1 from public.organisation_members
    where organisation_id = p_organisation_id
      and user_id = p_new_owner_id
  ) then
    raise exception 'New owner must already be a member';
  end if;

  update public.organisation_members
  set role = 'admin'
  where organisation_id = p_organisation_id
    and user_id = p_current_owner_id;

  update public.organisation_members
  set role = 'owner'
  where organisation_id = p_organisation_id
    and user_id = p_new_owner_id;
end;
$$;

revoke all on function public.transfer_organisation_ownership(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transfer_organisation_ownership(uuid, uuid, uuid)
  to service_role;
