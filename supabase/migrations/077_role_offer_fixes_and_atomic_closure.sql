begin;

-- An authorised organisation manager can finish a one-off job's review
-- journey even though they are not the original poster. The review is still
-- written by the organisation's representative, but attributed to the org so
-- it is never mistaken for a personal review by the posting user.
alter table public.reviews add column if not exists on_behalf_of_user_id uuid
  references public.profiles(id);

-- A role ends in one of two ways, and the distinction decides what happens to
-- held money:
--   'early'      — either party confirmed an early end via /role/end. Work
--                  stopped before the agreed term, so unpaid periods are
--                  abandoned and held money is held for review (dispute).
--   'completed'  — the advertised end date passed. The work ran its full
--                  term, so held money releases normally and earned periods
--                  are never silently cancelled.
alter table public.engagements add column if not exists termination_kind text
  check (termination_kind in ('completed', 'early'));

-- Cancelled reservation rows (a withdrawn or never-dispatched offer) are not
-- payment history — only block revision/reopening on a row that actually
-- moved money or attempted to.
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
    if e.id is not null and exists(
      select 1 from public.engagement_payments where engagement_id = e.id and status <> 'cancelled'
    ) then
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
    if exists(
      select 1 from public.engagement_payments where engagement_id = e.id and status <> 'cancelled'
    ) then
      raise exception 'Existing payment history requires reconciliation before reopening';
    end if;
    -- A withdrawn offer's own (cancelled) rows never charged anyone — clear
    -- them so the reopened engagement's schedule starts from period one.
    delete from public.engagement_payments where engagement_id = e.id and status = 'cancelled';
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

-- The prior version checked release_attempt_id (the OUTGOING transfer-to-
-- worker leg), which is never set this early — an unfunded engagement has no
-- release to reserve yet. The actual in-flight risk here is an INCOMING
-- charge attempt (collecting money from the organisation), tracked by
-- engagement_payments.status = 'processing'.
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
    where engagement_id = e.id and status = 'processing'
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
    where engagement_id = e.id and status in ('due', 'failed');

  update public.jobs set status = 'open', kinglancer_id = null
    where id = e.source_id and status = 'in_progress';
  update public.applications set status = 'rejected'
    where job_id = e.source_id and kinglancer_id = e.kinglancer_id and status in ('offered', 'accepted');

  return e;
end $$;

-- Deleting an open job and checking for a pending payment attempt used to be
-- two separate round trips — a payment could start in the gap between them.
-- update" lock on the same row to wait its turn: whichever transaction
-- commits first is the one that determines the outcome, never both.
create or replace function public.delete_open_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if j.id is null then raise exception 'Job not found'; end if;
  if j.status not in ('open', 'cancelled') then
    raise exception 'Only open or cancelled jobs can be deleted. Use the dispute system for active jobs.';
  end if;
  -- Mirror guard_open_job_cancellation: a non-terminal attempt can still
  -- represent a retryable or unresolved external payment. A legacy attempt
  -- marked `failed` is not proof the charge died — it may be retryable — so
  -- deleting the job would drop that evidence without reconciliation. Only
  -- terminal states (cancelled, expired, succeeded) carry no obligation.
  if exists(select 1 from public.payment_attempts where job_id = j.id and status not in ('cancelled', 'expired', 'succeeded')) then
    raise exception 'This job can''t be deleted while a payment is pending, failed or in progress.';
  end if;
  delete from public.jobs where id = p_job_id;
end $$;
revoke all on function public.delete_open_job(uuid) from public,anon,authenticated;
grant execute on function public.delete_open_job(uuid) to service_role;

-- Ending the engagement and closing its job used to be two separate writes
-- with the second one's failure silently ignored, and no way to repair it
-- afterwards (the engagement was already "ended"). This function is
-- idempotent — safe to call again if the job-status write didn't take.
--
-- `termination_kind` distinguishes the two ways a role ends:
--   * 'early'  — either party confirmed an early end via /role/end. The work
--                stopped before the agreed term, so unpaid periods are
--                abandoned and held money is held for review.
--   * 'completed' — the advertised end date passed (the natural cron, or a
--                late final instalment collected after that date). The work ran
--                its full term, so held money releases normally and earned
--                periods are never silently cancelled.
-- The manual early-end flow passes nothing (default 'early'); the
-- date-based completion path passes 'completed' explicitly.
create or replace function public.close_role_engagement(
  p_engagement_id uuid,
  p_termination_kind text default 'early'
)
returns public.engagements language plpgsql security definer set search_path = public as $$
declare e public.engagements;
begin
  select * into e from public.engagements where id = p_engagement_id for update;
  if e.id is null or e.source_kind <> 'org_role' then raise exception 'Role engagement not found'; end if;
  if e.status not in ('active', 'ended') then raise exception 'Role is not active'; end if;
  if p_termination_kind not in ('completed', 'early') then
    p_termination_kind := 'early';
  end if;
  update public.engagements set
    status = 'ended',
    ended_at = coalesce(ended_at, now()),
    termination_kind = p_termination_kind,
    end_requested_by = null,
    end_requested_at = null
  where id = e.id returning * into e;
  update public.jobs set status = 'approved' where id = e.source_id and status = 'in_progress';
  return e;
end $$;
revoke all on function public.close_role_engagement(uuid,text) from public,anon,authenticated;
grant execute on function public.close_role_engagement(uuid,text) to service_role;

commit;
