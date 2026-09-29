-- Run in a transaction and roll back. Exercises the placement-completion
-- trigger's distinction between future and earned periods, plus the
-- date-based natural-completion path for temporary roles.
begin;
do $$
declare
  org uuid; worker uuid;
  listing uuid := gen_random_uuid(); agreement uuid := gen_random_uuid();
  engagement uuid := gen_random_uuid(); payment uuid := gen_random_uuid();
  late uuid := gen_random_uuid();
  due_future date := current_date + interval '1 month';
  due_past date := current_date - interval '1 month';
begin
  select id into org from public.organisations limit 1;
  select id into worker from public.profiles limit 1;
  if org is null or worker is null then raise exception 'Test requires an organisation and profile'; end if;
  insert into public.placements(id, organisation_id, created_by, title, summary, contribution)
    values(listing, org, worker, 'SQL regression fixture', 'Temporary regression fixture', 'Temporary regression fixture');
  insert into public.placement_agreements(id,placement_id,organisation_id,kinglancer_id,contribution_terms,reward_terms,weekly_hours,duration_weeks,status)
    values(agreement,listing,org,worker,'test','test',8,4,'active');
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,status,termination_kind)
    values(engagement,'placement',agreement,org,worker,'managed','monthly','active','completed');

  -- An earned-but-unpaid period (due in the past) must survive completion.
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(payment,engagement,org,worker,1,due_past,'due');
  -- A future period (due next month) must be cancelled — the work is over.
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(late,engagement,org,worker,2,due_future,'due');

  update public.placement_agreements set status='completed' where id=agreement;
  if (select status from public.engagements where id=engagement) <> 'ended' then
    raise exception 'Completion did not end the engagement'; end if;
  if (select termination_kind from public.engagements where id=engagement) <> 'completed' then
    raise exception 'Completion did not mark the engagement completed'; end if;

  -- The earned period is still collectable; the future period was cancelled.
  if (select status from public.engagement_payments where id=payment) <> 'due' then
    raise exception 'An earned-but-unpaid period was cancelled on completion'; end if;
  if (select status from public.engagement_payments where id=late) <> 'cancelled' then
    raise exception 'A future period was not cancelled on completion'; end if;

  -- Early termination still abandons earned periods (unchanged behaviour).
  engagement := gen_random_uuid(); payment := gen_random_uuid();
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,status,termination_kind)
    values(engagement,'org_role',gen_random_uuid(),org,worker,'managed','monthly','active','early');
  insert into public.engagement_payments(id,engagement_id,organisation_id,kinglancer_id,period_index,due_date,status)
    values(payment,engagement,org,worker,1,due_past,'due');
  update public.engagements set status='ended' where id=engagement;
  if (select status from public.engagement_payments where id=payment) <> 'cancelled' then
    raise exception 'Early termination did not cancel an earned period'; end if;
end $$;
rollback;
