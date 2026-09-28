-- Run in a transaction and roll back. Uses existing identity IDs only as FK
-- references; every business record exercised here is a new synthetic fixture.
do $$
declare
  org uuid; worker uuid; listing uuid := gen_random_uuid(); agreement uuid := gen_random_uuid();
  engagement uuid := gen_random_uuid(); payment uuid := gen_random_uuid(); attempt uuid := gen_random_uuid();
  observed text; changed integer; admin_id uuid;
begin
  select id into org from public.organisations limit 1;
  select id into worker from public.profiles limit 1;
  if org is null or worker is null then raise exception 'Test requires an organisation and profile'; end if;
  insert into public.placements(id, organisation_id, created_by, title, summary, contribution)
    values(listing, org, worker, 'SQL regression fixture', 'Temporary regression fixture', 'Temporary regression fixture');
  insert into public.placement_agreements(id,placement_id,organisation_id,kinglancer_id,contribution_terms,reward_terms,weekly_hours,duration_weeks,status)
    values(agreement,listing,org,worker,'test','test',8,4,'active');
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,status)
    values(engagement,'placement',agreement,org,worker,'managed','monthly','active');
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(payment,engagement,org,worker,1,current_date,'due');
  -- Simulate a stale cancellation read after charging already reserved the row.
  update public.engagement_payments set status='processing',attempt_id=attempt where id=payment;
  update public.engagement_payments set status='cancelled' where id=payment
    and status in ('due','failed') and attempt_id is null and stripe_payment_intent_id is null;
  if (select status from public.engagement_payments where id=payment) <> 'processing' then
    raise exception 'Cancellation erased an in-flight attempt'; end if;
  -- Agreement/engagement/payment changes must roll back as one unit.
  begin
    update public.placement_agreements set status='cancelled' where id=agreement;
    raise exception 'simulate later failure';
  exception when raise_exception then null;
  end;
  if (select status from public.engagements where id=engagement) <> 'active' then
    raise exception 'Termination was not atomic'; end if;
  update public.placement_agreements set status='cancelled' where id=agreement;
  if (select status from public.engagements where id=engagement) <> 'ended' then
    raise exception 'Agreement did not terminate engagement'; end if;
  update public.engagement_payments set status='held',stripe_payment_intent_id='pi_regression' where id=payment;
  if (select status from public.engagement_payments where id=payment) <> 'disputed' then
    raise exception 'Late funding bypassed termination'; end if;
  update public.engagement_payments set release_attempt_id=attempt,release_operation='admin',release_attempt_started_at=now()-interval '2 days' where id=payment;
  update public.engagement_payments set release_attempt_id=gen_random_uuid(),release_operation='refund'
    where id=payment and release_attempt_id is null;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Unknown settlement was reclaimed'; end if;
  begin
    update public.engagement_payments set release_attempt_id=null where id=payment;
    raise exception using errcode='ZX001',message='Reservation was cleared';
  exception when raise_exception then null;
  end;
  -- Escalation protects both existing held funds and late incoming funds.
  engagement := gen_random_uuid(); payment := gen_random_uuid();
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,status)
    values(engagement,'org_role',gen_random_uuid(),org,worker,'managed','monthly','active');
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(payment,engagement,org,worker,1,current_date,'held');
  update public.engagements set settlement_hold_at=now(),settlement_hold_reason='Regression escalation' where id=engagement;
  if (select status from public.engagement_payments where id=payment) <> 'disputed' then
    raise exception 'Escalation did not freeze held funds'; end if;
  insert into public.engagement_payments(engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(engagement,org,worker,2,current_date,'due');
  update public.engagement_payments set status='processing',attempt_id=gen_random_uuid()
    where engagement_id=engagement and period_index=2;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Billing reserved a payment during escalation'; end if;
  select id into admin_id from public.profiles where role='admin' limit 1;
  begin
    perform public.resume_engagement_settlement(engagement,admin_id,'Do not resume disputed funds');
    raise exception using errcode='ZX001',message='Hold resumed before dispute resolution';
  exception when raise_exception then null; end;
  update public.engagement_payments set status='refunded' where id=payment;
  perform public.resume_engagement_settlement(engagement,admin_id,'All disputed funds resolved');
  assert (select settlement_hold_at is null from public.engagements where id=engagement), 'Hold not cleared';
  assert exists(select 1 from public.settlement_recovery_audit where payment_id=engagement and action='resume'), 'Resume audit missing';
  -- Ordinary completion cancels uncharged periods but preserves earned funds.
  engagement := gen_random_uuid(); payment := gen_random_uuid();
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,status)
    values(engagement,'org_role',gen_random_uuid(),org,worker,'managed','monthly','active');
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(payment,engagement,org,worker,1,current_date,'held');
  insert into public.engagement_payments(engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(engagement,org,worker,2,current_date,'due');
  update public.engagements set status='ended',termination_kind='completed' where id=engagement;
  if (select status from public.engagement_payments where id=payment) <> 'held' then
    raise exception 'Completion incorrectly disputed earned funds'; end if;
  if (select status from public.engagement_payments where engagement_id=engagement and period_index=2) <> 'cancelled' then
    raise exception 'Completion left future billing active'; end if;
  if has_table_privilege('authenticated','public.reviews','INSERT') then
    raise exception 'Direct review insert is still granted'; end if;
end $$;
select 'settlement lifecycle assertions passed' as result;
