-- Paid Organisation onboarding and Stripe subscription state.
--
-- Organisation details are held in a private setup draft until Stripe confirms
-- the first subscription. Activation then creates the Organisation, its sole
-- Owner membership and its subscription record in one locked transaction.

create table public.organisation_setup_drafts (
  id uuid primary key default uuid_generate_v4(),
  request_key uuid not null unique,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  organisation_type text not null
    check (organisation_type in (
      'company', 'charity', 'church', 'non_profit',
      'community_group', 'public_body', 'other'
    )),
  description text,
  country text not null default 'United Kingdom',
  location text,
  website text,
  registration_number text,
  selected_plan text not null
    check (selected_plan in ('starter', 'growth', 'scale')),
  stripe_price_id text not null,
  stripe_checkout_session_id text unique,
  status text not null default 'draft'
    check (status in (
      'draft', 'checkout_pending', 'active', 'cancelled', 'failed'
    )),
  organisation_id uuid unique references public.organisations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organisation_setup_drafts_actor_created_idx
  on public.organisation_setup_drafts (actor_id, created_at desc);

create table public.organisation_subscriptions (
  organisation_id uuid primary key
    references public.organisations(id) on delete cascade,
  plan text not null check (plan in ('starter', 'growth', 'scale')),
  status text not null check (status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_checkout_session_id text not null unique,
  stripe_price_id text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organisation_subscriptions_customer_idx
  on public.organisation_subscriptions (stripe_customer_id);

create trigger on_organisation_setup_drafts_updated
  before update on public.organisation_setup_drafts
  for each row execute function public.handle_updated_at();

create trigger on_organisation_subscriptions_updated
  before update on public.organisation_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.organisation_setup_drafts enable row level security;
alter table public.organisation_subscriptions enable row level security;

-- Setup drafts contain private onboarding data and are accessed only through
-- authenticated server routes. Members may read their Organisation's billing
-- status; all writes remain service-only.
create policy "Members read organisation subscriptions"
  on public.organisation_subscriptions
  for select using (
    exists (
      select 1
      from public.organisation_members
      where organisation_id = organisation_subscriptions.organisation_id
        and user_id = auth.uid()
    )
  );

grant select on public.organisation_subscriptions to authenticated;
grant all on public.organisation_setup_drafts to service_role;
grant all on public.organisation_subscriptions to service_role;

create or replace function public.activate_organisation_setup(
  p_draft_id uuid,
  p_actor_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.organisation_setup_drafts%rowtype;
  v_organisation_id uuid;
begin
  select *
  into v_draft
  from public.organisation_setup_drafts
  where id = p_draft_id
    and actor_id = p_actor_id
  for update;

  if not found then
    raise exception 'Organisation setup draft not found';
  end if;

  if v_draft.organisation_id is not null then
    return v_draft.organisation_id;
  end if;

  if v_draft.stripe_checkout_session_id is distinct from
     p_stripe_checkout_session_id then
    raise exception 'Checkout Session does not belong to this setup';
  end if;

  if p_subscription_status not in ('active', 'trialing') then
    raise exception 'Subscription is not active';
  end if;

  insert into public.organisations (
    name,
    organisation_type,
    description,
    country,
    location,
    website,
    registration_number,
    created_by
  )
  values (
    v_draft.name,
    v_draft.organisation_type,
    v_draft.description,
    v_draft.country,
    v_draft.location,
    v_draft.website,
    v_draft.registration_number,
    p_actor_id
  )
  returning id into v_organisation_id;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role
  )
  values (v_organisation_id, p_actor_id, 'owner');

  insert into public.organisation_subscriptions (
    organisation_id,
    plan,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_checkout_session_id,
    stripe_price_id
  )
  values (
    v_organisation_id,
    v_draft.selected_plan,
    p_subscription_status,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_checkout_session_id,
    v_draft.stripe_price_id
  );

  update public.organisation_setup_drafts
  set
    status = 'active',
    organisation_id = v_organisation_id
  where id = p_draft_id;

  return v_organisation_id;
end;
$$;

revoke all on function public.activate_organisation_setup(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.activate_organisation_setup(
  uuid, uuid, text, text, text, text
) to service_role;

-- Prevent an Owner from removing a workspace while Stripe is still billing
-- it. Organisations created before subscription onboarding have no row and
-- retain the existing deletion behaviour.
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
    from public.organisation_subscriptions
    where organisation_id = p_organisation_id
      and status in (
        'incomplete', 'active', 'trialing', 'past_due', 'unpaid', 'paused'
      )
  ) then
    raise exception 'Cancel the Organisation subscription before deletion';
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
