-- Additive deployment prerequisite. All RPCs are service-role only; routes
-- authorise callers before invoking them. Row locks make transitions atomic.
begin;
alter table public.engagement_payments
  add column if not exists attempt_id uuid,
  add column if not exists attempt_kind text check (attempt_kind in ('checkout', 'automatic')),
  add column if not exists attempt_started_at timestamptz,
  add column if not exists attempt_customer_id text,
  add column if not exists attempt_payment_method_id text,
  add column if not exists checkout_session_id text,
  add column if not exists fulfilled_at timestamptz;
-- Fail visibly if legacy duplicates require repair; never pick an arbitrary engagement.
create unique index if not exists engagements_unique_source_idx on public.engagements(source_kind, source_id);
create index if not exists engagement_payments_recovery_idx
  on public.engagement_payments (created_at, id) where fulfilled_at is null;

create or replace function public.respond_role_offer(p_engagement_id uuid, p_worker_id uuid, p_action text)
returns public.engagements language plpgsql set search_path = public as $$
declare e public.engagements; j public.jobs;
begin
  -- Lock job before engagement, matching offer creation to avoid deadlocks.
  select * into e from public.engagements where id = p_engagement_id;
  select * into j from public.jobs where id = e.source_id for update;
  select * into e from public.engagements where id = p_engagement_id for update;
  if e.id is null or e.kinglancer_id <> p_worker_id or e.source_kind <> 'org_role' then
    raise exception 'Role offer not found';
  end if;
  select * into j from public.jobs where id = e.source_id for update;
  if j.id is null or j.status not in ('open', 'in_progress') or
     (j.kinglancer_id is not null and j.kinglancer_id <> p_worker_id) then
    raise exception 'Job is no longer available';
  end if;
  if p_action = 'accept' then
    if e.status not in ('pending_acceptance', 'pending_funding', 'active') then
      raise exception 'Offer can no longer be accepted';
    end if;
    update public.engagements set
      status = case when e.status = 'pending_acceptance' then
        case when e.settlement_mode = 'managed' then 'pending_funding' else 'active' end else e.status end,
      kinglancer_signed_at = coalesce(kinglancer_signed_at, now()),
      started_at = case when e.settlement_mode = 'direct' then coalesce(started_at, now()) else started_at end
      where id = e.id returning * into e;
    update public.applications set status = 'accepted'
      where job_id = j.id and kinglancer_id = p_worker_id and status in ('offered', 'accepted');
    if not found then raise exception 'Offered application not found'; end if;
    update public.jobs set status = 'in_progress', kinglancer_id = p_worker_id where id = j.id;
  elsif p_action = 'decline' then
    if e.status not in ('pending_acceptance', 'cancelled') then raise exception 'Offer already accepted'; end if;
    update public.engagements set status = 'cancelled', end_reason = 'Declined by Kinglancer'
      where id = e.id returning * into e;
    update public.applications set status = 'rejected'
      where job_id = j.id and kinglancer_id = p_worker_id and status in ('offered', 'rejected');
    if not found then raise exception 'Offered application not found'; end if;
  else raise exception 'Invalid action'; end if;
  return e;
end $$;

create or replace function public.respond_placement_offer(p_agreement_id uuid, p_worker_id uuid, p_action text)
returns public.placement_agreements language plpgsql set search_path = public as $$
declare a public.placement_agreements;
begin
  select * into a from public.placement_agreements where id = p_agreement_id for update;
  if a.id is null or a.kinglancer_id <> p_worker_id then raise exception 'Agreement not found'; end if;
  if p_action = 'accept' then
    if a.status not in ('pending_acceptance', 'pending_funding', 'active') then raise exception 'Offer unavailable'; end if;
    update public.placement_agreements set
      status = case when a.status = 'pending_acceptance' then
        case when a.payment_mode = 'managed' and a.monthly_amount > 0 then 'pending_funding' else 'active' end else a.status end,
      kinglancer_signed_at = coalesce(kinglancer_signed_at, now())
      where id = a.id returning * into a;
    update public.placement_applications set status = 'accepted'
      where placement_id = a.placement_id and kinglancer_id = p_worker_id and status in ('offered', 'accepted');
  elsif p_action = 'decline' then
    if a.status not in ('pending_acceptance', 'cancelled') then raise exception 'Offer already accepted'; end if;
    update public.placement_agreements set status = 'cancelled' where id = a.id returning * into a;
    update public.placement_applications set status = 'rejected'
      where placement_id = a.placement_id and kinglancer_id = p_worker_id and status in ('offered', 'rejected');
  else raise exception 'Invalid action'; end if;
  if not found then raise exception 'Offered application not found'; end if;
  return a;
end $$;

create or replace function public.offer_placement_application(
  p_application_id uuid, p_signer_id uuid, p_expected_plan text,
  p_seat_limit integer, p_reward_terms text, p_monthly_amount numeric
) returns public.placement_agreements language plpgsql set search_path = public as $$
declare a public.placement_applications; p public.placements;
  s public.organisation_subscriptions; g public.placement_agreements; reserved integer;
begin
  select * into a from public.placement_applications where id = p_application_id;
  select * into p from public.placements where id = a.placement_id;
  if p.id is null then raise exception 'Placement not found'; end if;
  -- Serialise every seat allocation for this organisation, across placements.
  perform 1 from public.organisations where id = p.organisation_id for update;
  select * into p from public.placements where id = p.id for update;
  select * into a from public.placement_applications where id = p_application_id for update;
  select * into g from public.placement_agreements where placement_id = p.id and kinglancer_id = a.kinglancer_id;
  if a.status = 'offered' and g.id is not null then return g; end if;
  if a.status <> 'pending' or p.status <> 'open' then raise exception 'Application or placement unavailable'; end if;
  select * into s from public.organisation_subscriptions where organisation_id = p.organisation_id for update;
  if s.organisation_id is null or s.status not in ('active', 'trialing') or s.plan is distinct from p_expected_plan then
    raise exception 'Subscription changed or inactive; refresh and retry';
  end if;
  if p_seat_limit is null or p_seat_limit < 1 then raise exception 'Invalid participant limit'; end if;
  select count(*) into reserved from public.placement_agreements where organisation_id = p.organisation_id
    and status in ('pending_acceptance', 'pending_funding', 'active');
  if reserved >= p_seat_limit then raise exception 'Participant limit reached'; end if;
  insert into public.placement_agreements
    (placement_id, organisation_id, kinglancer_id, contribution_terms, reward_terms,
     weekly_hours, duration_weeks, status, org_signed_by, org_signed_at, payment_mode, monthly_amount)
    values (p.id, p.organisation_id, a.kinglancer_id, p.contribution, p_reward_terms,
      p.weekly_hours, p.duration_weeks, 'pending_acceptance', p_signer_id, now(), p.payment_mode, p_monthly_amount)
    returning * into g;
  update public.placement_applications set status = 'offered' where id = a.id;
  return g;
end $$;

create or replace function public.offer_role_application(p_application_id uuid, p_signer_id uuid)
returns public.engagements language plpgsql set search_path = public as $$
declare a public.applications; j public.jobs; e public.engagements;
begin
  select * into a from public.applications where id = p_application_id;
  select * into j from public.jobs where id = a.job_id for update;
  select * into a from public.applications where id = p_application_id for update;
  if j.id is null or j.posting_type <> 'role' or j.organisation_id is null or j.status <> 'open' then
    raise exception 'Role is no longer available';
  end if;
  if a.status not in ('pending', 'offered') then raise exception 'Application unavailable'; end if;
  if j.pay_negotiable or j.pay_amount is null or j.pay_amount <= 0 or j.pay_cadence is null or j.settlement_mode is null then
    raise exception 'Fixed payment terms are required';
  end if;
  select * into e from public.engagements where source_kind = 'org_role' and source_id = j.id for update;
  if e.id is not null and e.status <> 'cancelled' then
    if e.status <> 'pending_acceptance' or e.kinglancer_id <> a.kinglancer_id then
      raise exception 'Another offer already exists';
    end if;
  elsif e.id is not null then
    if exists(select 1 from public.engagement_payments where engagement_id = e.id) then
      raise exception 'Existing payment history requires reconciliation before reopening';
    end if;
    update public.engagements set kinglancer_id = a.kinglancer_id,
      status = 'pending_acceptance', settlement_mode = j.settlement_mode,
      cadence = j.pay_cadence, amount_per_period = j.pay_amount,
      org_signed_by = p_signer_id, org_signed_at = now(), kinglancer_signed_at = null,
      started_at = null, ended_at = null, end_requested_by = null, end_requested_at = null, end_reason = null
      where id = e.id returning * into e;
  else
    insert into public.engagements(source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,amount_per_period,status,org_signed_by,org_signed_at)
      values('org_role',j.id,j.organisation_id,a.kinglancer_id,j.settlement_mode,j.pay_cadence,j.pay_amount,'pending_acceptance',p_signer_id,now())
      returning * into e;
  end if;
  update public.applications set status = 'offered' where id = a.id;
  return e;
end $$;
revoke all on function public.offer_role_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.offer_role_application(uuid, uuid) to service_role;

revoke all on function public.respond_role_offer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.respond_placement_offer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.offer_placement_application(uuid, uuid, text, integer, text, numeric) from public, anon, authenticated;
grant execute on function public.respond_role_offer(uuid, uuid, text) to service_role;
grant execute on function public.respond_placement_offer(uuid, uuid, text) to service_role;
grant execute on function public.offer_placement_application(uuid, uuid, text, integer, text, numeric) to service_role;
commit;
