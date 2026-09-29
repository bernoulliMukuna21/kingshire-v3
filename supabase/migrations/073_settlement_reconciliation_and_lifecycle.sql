begin;
-- Unknown outcomes must remain reserved until reconciled; age is not evidence
-- that an external transfer/refund did not happen.
alter table public.engagement_payments
  add column if not exists release_operation text,
  add column if not exists stripe_refund_id text,
  add column if not exists settlement_error text;
alter table public.engagements
  add column if not exists settlement_hold_at timestamptz,
  add column if not exists settlement_hold_reason text,
  add column if not exists termination_kind text;

-- All callers, including older deployments, get atomic lifecycle propagation.
create or replace function public.sync_engagement_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('ended', 'cancelled') then
    update public.engagement_payments set status = 'cancelled'
    where engagement_id = new.id and status in ('due', 'failed')
      and attempt_id is null and stripe_payment_intent_id is null;
  end if;
  if new.settlement_hold_at is not null or
     (new.status in ('ended', 'cancelled') and new.termination_kind is distinct from 'completed') then
    update public.engagement_payments
    set status = 'disputed', dispute_reason = coalesce(new.settlement_hold_reason, new.end_reason, 'Engagement ended')
    where engagement_id = new.id and status = 'held' and release_attempt_id is null;
  end if;
  return new;
end $$;
drop trigger if exists sync_engagement_settlement on public.engagements;
create trigger sync_engagement_settlement
  after update of status, settlement_hold_at on public.engagements
  for each row execute function public.sync_engagement_settlement();

create or replace function public.sync_placement_termination()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelled', 'completed') and old.status is distinct from new.status then
    update public.engagements set status = 'ended', ended_at = now(),
      termination_kind = case when new.status = 'completed' then 'completed' else 'early' end,
      end_reason = case when new.status = 'completed' then 'Placement completed' else 'Placement ended early' end
    where source_kind = 'placement' and source_id = new.id and status not in ('ended', 'cancelled');
  end if;
  return new;
end $$;
drop trigger if exists sync_placement_termination on public.placement_agreements;
create trigger sync_placement_termination after update of status on public.placement_agreements
  for each row execute function public.sync_placement_termination();

-- Serialize payment transitions with engagement changes. A concurrent deadlock
-- aborts one transaction safely; no partial lifecycle change can commit.
create or replace function public.guard_engagement_payment_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare e public.engagements;
begin
  select * into strict e from public.engagements where id = new.engagement_id for share;
  if TG_OP = 'UPDATE' then
    if old.release_attempt_id is not null and new.release_attempt_id is distinct from old.release_attempt_id then
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
drop trigger if exists guard_engagement_payment_transition on public.engagement_payments;
create trigger guard_engagement_payment_transition before insert or update on public.engagement_payments
  for each row execute function public.guard_engagement_payment_transition();

-- Reviews are already written through the authorized server route. Remove the
-- alternate REST write path, which bypassed payment/window validation.
drop policy if exists "Users can leave a review" on public.reviews;
revoke insert on public.reviews from anon, authenticated;
revoke execute on function public.sync_engagement_settlement() from public, anon, authenticated;
revoke execute on function public.sync_placement_termination() from public, anon, authenticated;
revoke execute on function public.guard_engagement_payment_transition() from public, anon, authenticated;
commit;
