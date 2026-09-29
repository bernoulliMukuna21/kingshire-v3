begin;
alter table public.transactions
  add column if not exists release_attempt_id uuid,
  add column if not exists release_operation text,
  add column if not exists release_attempt_started_at timestamptz,
  add column if not exists stripe_refund_id text,
  add column if not exists settlement_error text;
alter table public.transactions
  add column if not exists release_outcome text,
  add column if not exists release_request jsonb,
  add column if not exists release_dispatch_started_at timestamptz,
  add column if not exists release_idempotency_key text,
  add column if not exists release_failure_code text;
alter table public.engagement_payments
  add column if not exists release_outcome text,
  add column if not exists release_request jsonb,
  add column if not exists release_dispatch_started_at timestamptz,
  add column if not exists release_idempotency_key text,
  add column if not exists release_failure_code text;

create table if not exists public.settlement_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  ledger text not null, payment_id uuid not null, attempt_id uuid,
  actor_id uuid not null references public.profiles(id),
  action text not null, reason text not null, prior_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.settlement_recovery_audit enable row level security;
revoke all on public.settlement_recovery_audit from anon, authenticated;
grant all on public.settlement_recovery_audit to service_role;

-- Always lock job then ledger. A dispute, approval, refund and manual payment
-- compete for the same row before any external side effect.
create or replace function public.reserve_job_settlement(p_payment uuid, p_action text, p_dispute uuid default null)
returns public.transactions language plpgsql security definer set search_path=public as $$
declare t public.transactions; j public.jobs; job_uuid uuid;
begin
  select job_id into job_uuid from public.transactions where id=p_payment;
  select * into j from public.jobs where id=job_uuid for update;
  select * into t from public.transactions where id=p_payment for update;
  if t.id is null or t.status not in ('held','released') or t.stripe_refund_id is not null then return null; end if;
  if t.release_attempt_id is not null then return null; end if;
  if p_dispute is not null then
    if j.status <> 'disputed' or not exists(select 1 from public.disputes where id=p_dispute and job_id=j.id and status='open') then return null; end if;
  elsif p_action='cancel_refund' then
    if j.status <> 'in_progress' or t.created_at < now()-interval '2 hours' then return null; end if;
  elsif j.status not in ('completed','approved') or exists(select 1 from public.disputes where job_id=j.id and status='open') then return null;
  end if;
  if p_action not in ('transfer','refund','cancel_refund','queue_manual','queue_stripe','manual_paid','manual_refund') then raise exception 'Invalid settlement action'; end if;
  if t.stripe_transfer_id is not null or t.manual_payout_reference is not null then return null; end if;
  if p_action in ('refund','manual_refund') and p_dispute is null then return null; end if;
  if p_action in ('refund','manual_refund','cancel_refund') and t.status <> 'held' then return null; end if;
  if p_action='manual_refund' and t.payment_method <> 'bank_transfer' then return null; end if;
  if p_action in ('transfer','refund','cancel_refund','queue_stripe') and (t.payment_method='bank_transfer' or t.payout_method='manual') then return null; end if;
  if p_action in ('transfer','refund','cancel_refund') and t.stripe_payment_intent_id is null then return null; end if;
  if p_action='manual_paid' and (j.status <> 'approved' or t.status <> 'held' or (t.payout_method is distinct from 'manual' and t.payment_method is distinct from 'bank_transfer')) then return null; end if;
  if p_action in ('queue_manual','queue_stripe') and t.status <> 'held' then return null; end if;
  update public.transactions set release_attempt_id=gen_random_uuid(),release_operation=p_action,
    release_attempt_started_at=now(),release_outcome='reserved',settlement_error=null
    where id=p_payment returning * into t;
  return t;
end $$;

create or replace function public.finish_job_settlement(p_payment uuid,p_attempt uuid,p_external text default null,p_reference text default null,p_actor uuid default null)
returns public.transactions language plpgsql security definer set search_path=public as $$
declare t public.transactions; j public.jobs; job_uuid uuid; refunded boolean;
begin
  select job_id into job_uuid from public.transactions where id=p_payment;
  select * into j from public.jobs where id=job_uuid for update;
  select * into t from public.transactions where id=p_payment for update;
  if t.release_attempt_id is distinct from p_attempt then raise exception 'Reservation changed'; end if;
  if t.release_outcome='succeeded' then return t; end if;
  if t.release_operation in ('transfer','refund','cancel_refund') and p_external is null then raise exception 'Verified external outcome required'; end if;
  if t.release_operation='manual_paid' and (nullif(trim(p_reference),'') is null or p_actor is null) then raise exception 'Manual payout reference required'; end if;
  perform set_config('kingshire.job_settlement',p_attempt::text,true);
  refunded := t.release_operation in ('refund','cancel_refund','manual_refund');
  update public.transactions set
    status=case when refunded then 'refunded' when t.release_operation='queue_manual' then 'held' else 'released' end,
    released_at=case when not refunded and t.release_operation <> 'queue_manual' then coalesce(released_at,now()) else released_at end,
    stripe_transfer_id=case when t.release_operation='transfer' then p_external else stripe_transfer_id end,
    stripe_refund_id=case when t.release_operation in ('refund','cancel_refund') then p_external else stripe_refund_id end,
    payout_method=case when t.release_operation in ('queue_manual','manual_paid') then 'manual' else payout_method end,
    manual_payout_reference=case when t.release_operation='manual_paid' then p_reference else manual_payout_reference end,
    confirmed_by=case when t.release_operation='manual_paid' then p_actor else confirmed_by end,
    release_outcome='succeeded', settlement_error=null
    where id=p_payment returning * into t;
  update public.jobs set status=case when refunded then 'cancelled' else 'approved' end where id=j.id;
  update public.disputes set status='resolved',resolved_at=now() where job_id=j.id and status='open';
  if not refunded and j.status <> 'approved' and j.kinglancer_id is not null then
    update public.profiles set jobs_completed=jobs_completed+1 where id=j.kinglancer_id;
  end if;
  -- Queueing did not move money. Record it before allowing the later payout.
  if t.release_operation in ('queue_manual','queue_stripe') then
    insert into public.settlement_recovery_audit(ledger,payment_id,attempt_id,actor_id,action,reason,prior_state)
      values('transactions',t.id,t.release_attempt_id,coalesce(p_actor,j.client_id),'queued',t.release_operation,to_jsonb(t));
    update public.transactions set release_attempt_id=null,release_outcome=null,release_operation=null,release_attempt_started_at=null where id=t.id returning * into t;
  end if;
  perform set_config('kingshire.job_settlement','',true);
  return t;
end $$;

create or replace function public.raise_job_dispute(p_job uuid,p_actor uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare j public.jobs; t public.transactions;
begin
  select * into j from public.jobs where id=p_job for update;
  select * into t from public.transactions where job_id=p_job for update;
  if j.status not in ('in_progress','completed') or t.status <> 'held' or t.id is null or
    t.release_attempt_id is not null or t.stripe_transfer_id is not null or t.manual_payout_reference is not null then
    raise exception 'Job settlement has already started';
  end if;
  update public.jobs set status='disputed' where id=p_job;
  insert into public.disputes(job_id,raised_by,reason) values(p_job,p_actor,p_reason);
end $$;

-- An administrator can reset only a known non-dispatch or a recorded definitive
-- rejection. The same transaction retains the previous request and their reason.
create or replace function public.reset_settlement_reservation(p_ledger text,p_payment uuid,p_attempt uuid,p_actor uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare prior jsonb; table_name text;
begin
  if p_ledger not in ('transactions','engagement_payments') or length(trim(p_reason)) < 10 then raise exception 'Invalid reset request'; end if;
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Administrator required'; end if;
  table_name := p_ledger;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',table_name) into prior using p_payment;
  if prior->>'release_attempt_id' is distinct from p_attempt::text then raise exception 'Reservation changed'; end if;
  if prior->>'stripe_transfer_id' is not null or prior->>'stripe_refund_id' is not null then raise exception 'External outcome already exists'; end if;
  if not coalesce((prior->>'release_outcome'='reserved' and prior->>'release_dispatch_started_at' is null) or
     (prior->>'release_outcome'='failed' and prior->>'release_failure_code'='balance_insufficient'),false) then
    raise exception 'Outcome is uncertain; reconcile or retry the same request';
  end if;
  insert into public.settlement_recovery_audit(ledger,payment_id,attempt_id,actor_id,action,reason,prior_state)
    values(p_ledger,p_payment,p_attempt,p_actor,'reset',p_reason,prior);
  perform set_config('kingshire.settlement_reset','allowed',true);
  execute format('update public.%I set release_attempt_id=null,release_operation=null,release_attempt_started_at=null,release_outcome=null,release_request=null,release_dispatch_started_at=null,release_idempotency_key=null,release_failure_code=null,settlement_error=null where id=$1',table_name) using p_payment;
  perform set_config('kingshire.settlement_reset','',true);
end $$;

create or replace function public.resume_engagement_settlement(p_engagement uuid,p_actor uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare e public.engagements;
begin
  if length(trim(p_reason))<10 or not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Administrator and reason required'; end if;
  select * into e from public.engagements where id=p_engagement for update;
  if e.id is null or e.status <> 'active' or e.settlement_hold_at is null then raise exception 'No active hold to resume'; end if;
  if exists(select 1 from public.engagement_payments where engagement_id=e.id and
    (status in ('disputed','processing','failed') or (release_attempt_id is not null and status not in ('released','refunded')))) then
    raise exception 'Resolve outstanding payments before resuming';
  end if;
  insert into public.settlement_recovery_audit(ledger,payment_id,actor_id,action,reason,prior_state)
    values('engagements',e.id,p_actor,'resume',p_reason,to_jsonb(e));
  update public.engagements set settlement_hold_at=null,settlement_hold_reason=null where id=e.id;
end $$;

-- Legacy callers cannot overwrite a reservation held by the shared service.
create or replace function public.guard_job_settlement_write()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='refunded' and new.status <> old.status then raise exception 'Refund is terminal'; end if;
  if new.status='refunded' and (old.stripe_transfer_id is not null or old.manual_payout_reference is not null) then raise exception 'Payment already transferred'; end if;
  if old.release_attempt_id is not null and
     (new.status is distinct from old.status or new.payout_method is distinct from old.payout_method or
      new.manual_payout_reference is distinct from old.manual_payout_reference or new.release_attempt_id is distinct from old.release_attempt_id) and
     coalesce(current_setting('kingshire.job_settlement',true),'') <> old.release_attempt_id::text and
     coalesce(current_setting('kingshire.settlement_reset',true),'') <> 'allowed' then
    raise exception 'Settlement is reserved; use the settlement service';
  end if;
  return new;
end $$;
drop trigger if exists guard_job_settlement_write on public.transactions;
create trigger guard_job_settlement_write before update on public.transactions for each row execute function public.guard_job_settlement_write();

create or replace function public.guard_job_status_during_settlement()
returns trigger language plpgsql security definer set search_path=public as $$
declare attempt uuid;
begin
  if new.status is distinct from old.status then
    select release_attempt_id into attempt from public.transactions where job_id=old.id for update;
    if attempt is not null and coalesce(current_setting('kingshire.job_settlement',true),'') <> attempt::text then
      raise exception 'Settlement is reserved; job state cannot change';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_job_status_during_settlement on public.jobs;
create trigger guard_job_status_during_settlement before update of status on public.jobs for each row execute function public.guard_job_status_during_settlement();
-- Dispute creation must use the transaction-aware server operation.
drop policy if exists "Users can raise disputes" on public.disputes;
revoke insert on public.disputes from anon,authenticated;
revoke all on function public.guard_job_settlement_write() from public,anon,authenticated;
revoke all on function public.guard_job_status_during_settlement() from public,anon,authenticated;

-- Extend the existing guard without weakening protection for unknown outcomes.
create or replace function public.guard_engagement_payment_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare e public.engagements;
begin
  select * into strict e from public.engagements where id = new.engagement_id for share;
  if TG_OP = 'UPDATE' then
    if old.release_attempt_id is not null and new.release_attempt_id is distinct from old.release_attempt_id and coalesce(current_setting('kingshire.settlement_reset',true),'') <> 'allowed' then
      raise exception 'Settlement outcome must be reconciled before replacing a reservation';
    end if;
    if new.status = 'processing' and old.status <> 'processing' and
       (e.status not in ('active', 'pending_funding') or e.settlement_hold_at is not null) then
      return null;
    end if;
    if old.release_attempt_id is null and new.release_attempt_id is not null and
       new.release_operation = 'automatic' and
       (e.settlement_hold_at is not null or (e.status in ('ended','cancelled') and e.termination_kind is distinct from 'completed')) then
      return null;
    end if;
  end if;
  if new.status = 'due' and e.status in ('ended', 'cancelled') then new.status := 'cancelled'; end if;
  if new.status = 'held' and (e.settlement_hold_at is not null or
      (e.status in ('ended','cancelled') and e.termination_kind is distinct from 'completed')) then
    new.status := 'disputed';
    new.dispute_reason := coalesce(e.settlement_hold_reason, e.end_reason, 'Settlement on hold');
  end if;
  return new;
end $$;
revoke all on function public.reserve_job_settlement(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_job_settlement(uuid,text,uuid) to service_role;
revoke all on function public.finish_job_settlement(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.finish_job_settlement(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.raise_job_dispute(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.raise_job_dispute(uuid,uuid,text) to service_role;
revoke all on function public.reset_settlement_reservation(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reset_settlement_reservation(text,uuid,uuid,uuid,text) to service_role;
revoke all on function public.resume_engagement_settlement(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.resume_engagement_settlement(uuid,uuid,text) to service_role;
commit;
