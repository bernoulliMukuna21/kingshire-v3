begin;

-- The column records the organisation member who physically submitted a
-- review. reviewer_id remains the posting client so the worker's reciprocal
-- review matches the same two parties and the double-blind reveal can fire.
comment on column public.reviews.on_behalf_of_user_id is
  'Organisation member who submitted the review; null for personal reviews. reviewer_id remains the posting client.';

-- These signatures replaced older overloads. Keeping both makes PostgREST
-- calls with defaulted arguments ambiguous and lets older SQL callers bypass
-- atomic pay-setting.
drop function if exists public.offer_role_application(uuid, uuid);
drop function if exists public.close_role_engagement(uuid);

-- Forward migration for databases where 073 has already run. On natural
-- completion, preserve earned periods (due today or earlier) for collection
-- and cancel only future unattempted periods. Early termination retains the
-- original behaviour and abandons all untouched periods.
create or replace function public.sync_engagement_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('ended', 'cancelled') then
    if new.termination_kind is distinct from 'completed' then
      update public.engagement_payments set status = 'cancelled'
      where engagement_id = new.id and status in ('due', 'failed')
        and attempt_id is null and stripe_payment_intent_id is null;
    else
      update public.engagement_payments set status = 'cancelled'
      where engagement_id = new.id and status in ('due', 'failed')
        and attempt_id is null and stripe_payment_intent_id is null
        and due_date > current_date;
    end if;
  end if;
  if new.settlement_hold_at is not null or
     (new.status in ('ended', 'cancelled') and new.termination_kind is distinct from 'completed') then
    update public.engagement_payments
    set status = 'disputed', dispute_reason = coalesce(new.settlement_hold_reason, new.end_reason, 'Engagement ended')
    where engagement_id = new.id and status = 'held' and release_attempt_id is null;
  end if;
  return new;
end $$;

commit;
