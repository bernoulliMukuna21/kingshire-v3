begin;

-- Pay-revision + offer creation used to be two separate round trips (TS set
-- the job's pay fields, then called this function) — a failure in between
-- left the posting permanently fixed-pay with no offer sent. Folding the
-- revision into this function makes it atomic, and allowing revision any
-- time it's safe (no pending/active engagement, no payment history) — not
-- just once — means a declined candidate no longer leaves the posting
-- stuck on terms nobody else can be offered.
create or replace function public.offer_role_application(
  p_application_id uuid,
  p_signer_id uuid,
  p_pay_amount numeric default null,
  p_pay_cadence text default null,
  p_settlement_mode text default null
)
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

  select * into e from public.engagements where source_kind = 'org_role' and source_id = j.id for update;

  if p_pay_amount is not null then
    if e.id is not null and e.status <> 'cancelled' then
      raise exception 'Cannot revise pay while an offer is pending or active';
    end if;
    if e.id is not null and exists(select 1 from public.engagement_payments where engagement_id = e.id) then
      raise exception 'Existing payment history requires reconciliation before revising pay';
    end if;
    if p_pay_cadence not in ('weekly', 'monthly') then
      raise exception 'Choose weekly or monthly pay for this role';
    end if;
    if p_settlement_mode not in ('managed', 'direct') then
      raise exception 'Choose how this role will be settled';
    end if;
    if p_pay_amount <= 0 then raise exception 'Enter a valid recurring pay amount'; end if;
    update public.jobs set pay_amount = p_pay_amount, pay_cadence = p_pay_cadence,
      settlement_mode = p_settlement_mode, pay_negotiable = false
      where id = j.id returning * into j;
  end if;

  if j.pay_negotiable or j.pay_amount is null or j.pay_amount <= 0 or j.pay_cadence is null or j.settlement_mode is null then
    raise exception 'Fixed payment terms are required';
  end if;

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
revoke all on function public.offer_role_application(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.offer_role_application(uuid,uuid,numeric,text,text) to service_role;

-- Withdrawing before funding is low-stakes (no money moved) and doesn't need
-- the mutual propose/confirm dance that ending an active, paid role does. A
-- payment currently reserved/dispatched (uncertain outcome) blocks withdrawal
-- outright — we don't cancel out from under a settlement in flight. One that
-- already succeeded (a late race) freezes the engagement via the existing
-- settlement-hold mechanism for admin reconciliation, rather than silently
-- cancelling a role that was actually paid for.
create or replace function public.withdraw_pending_engagement(
  p_engagement_id uuid,
  p_actor_id uuid,
  p_reason text default null
)
returns public.engagements language plpgsql security definer set search_path = public as $$
declare e public.engagements; has_pending boolean; has_money boolean;
begin
  select * into e from public.engagements where id = p_engagement_id for update;
  if e.id is null or e.status not in ('pending_acceptance', 'pending_funding') then
    raise exception 'Only an unfunded engagement can be withdrawn';
  end if;
  if e.source_kind <> 'org_role' then
    raise exception 'Withdrawal is not yet supported for this engagement type';
  end if;

  select exists(
    select 1 from public.engagement_payments
    where engagement_id = e.id and release_attempt_id is not null
  ) into has_pending;
  if has_pending then
    raise exception 'A payment is currently processing for this role; wait for it to resolve';
  end if;

  select exists(
    select 1 from public.engagement_payments
    where engagement_id = e.id and status in ('held', 'released')
  ) into has_money;

  if has_money then
    update public.engagements set
      settlement_hold_at = now(),
      settlement_hold_reason = coalesce(
        nullif(trim(p_reason), ''),
        'Withdrawn after a payment was already collected; needs reconciliation'
      )
      where id = e.id returning * into e;
    return e;
  end if;

  update public.engagements set
    status = 'cancelled',
    end_reason = coalesce(nullif(trim(p_reason), ''), 'Withdrawn before funding'),
    ended_at = now()
    where id = e.id returning * into e;
  update public.engagement_payments set status = 'cancelled'
    where engagement_id = e.id and status = 'due';

  update public.jobs set status = 'open', kinglancer_id = null
    where id = e.source_id and status = 'in_progress';
  update public.applications set status = 'rejected'
    where job_id = e.source_id and kinglancer_id = e.kinglancer_id and status in ('offered', 'accepted');

  return e;
end $$;
revoke all on function public.withdraw_pending_engagement(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.withdraw_pending_engagement(uuid,uuid,text) to service_role;

commit;
