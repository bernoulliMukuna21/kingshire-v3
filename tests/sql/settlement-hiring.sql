-- Run with: supabase db query --linked --file tests/sql/settlement-hiring.sql
-- Uses existing profile IDs only as foreign keys; all fixtures roll back.
begin;
do $$
<<settlement_hiring>>
declare owner_id uuid; worker_id uuid; org_id uuid := gen_random_uuid();
  placement_id uuid := gen_random_uuid(); application_id uuid := gen_random_uuid();
  second_app uuid := gen_random_uuid(); job_id uuid := gen_random_uuid();
  engagement_id uuid := gen_random_uuid(); agreement public.placement_agreements;
  first_signed timestamptz; failed boolean;
begin
  select id into owner_id from public.profiles order by id limit 1;
  select id into worker_id from public.profiles where id <> owner_id order by id limit 1;
  if worker_id is null then raise exception 'Two staging profiles are required'; end if;
  insert into public.organisations(id,name,created_by) values(org_id,'Rollback audit fixture',owner_id);
  insert into public.organisation_subscriptions(organisation_id,plan,status,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,stripe_price_id)
    values(org_id,'starter','active','fixture_customer','fixture_sub','fixture_session','fixture_price');
  insert into public.placements(id,organisation_id,created_by,title,summary,contribution,reward,status,payment_mode)
    values(placement_id,org_id,owner_id,'Rollback fixture','A staging fixture only','A contribution for testing','A reward for testing','open','managed');
  insert into public.placement_applications(id,placement_id,kinglancer_id) values(application_id,placement_id,worker_id),(second_app,placement_id,owner_id);
  agreement := public.offer_placement_application(application_id,owner_id,'starter',1,'Reward terms',100);
  assert (select status = 'offered' from public.placement_applications where id = application_id), 'Offer did not update application';
  assert (public.offer_placement_application(application_id,owner_id,'starter',1,'Reward terms',100)).id = agreement.id, 'Offer retry duplicated agreement';
  failed := false;
  begin
    perform public.offer_placement_application(second_app,owner_id,'starter',1,'Reward terms',100);
  exception when others then failed := true; end;
  assert failed, 'Seat capacity was not enforced';
  assert (select status = 'pending' from public.placement_applications where id = second_app), 'Failed offer modified application';
  agreement := public.respond_placement_offer(agreement.id,worker_id,'accept');
  first_signed := agreement.kinglancer_signed_at;
  assert agreement.status = 'pending_funding', 'Managed agreement did not await funding';
  assert (select status = 'accepted' from public.placement_applications where id = application_id), 'Accept did not update application';
  agreement := public.respond_placement_offer(agreement.id,worker_id,'accept');
  assert agreement.kinglancer_signed_at = first_signed, 'Retry changed signature timestamp';

  insert into public.jobs(id,client_id,created_by,organisation_id,title,description,budget,status,posting_type,pay_amount,pay_cadence,settlement_mode,employment_type)
    values(job_id,owner_id,owner_id,org_id,'Rollback role','Staging role fixture',100,'open','role',100,'monthly','managed','permanent');
  insert into public.engagements(id,source_kind,source_id,organisation_id,kinglancer_id,settlement_mode,cadence,amount_per_period)
    values(engagement_id,'org_role',job_id,org_id,worker_id,'managed','monthly',100);
  -- Missing application must roll back the engagement transition as well.
  failed := false;
  begin perform public.respond_role_offer(engagement_id,worker_id,'accept');
  exception when others then failed := true; end;
  assert failed, 'Missing application was ignored';
  assert (select status = 'pending_acceptance' from public.engagements where id = engagement_id), 'Partial role acceptance escaped transaction';
  insert into public.applications(job_id,kinglancer_id,cover_letter,status) values(job_id,worker_id,'A fixture application','pending');
  perform public.offer_role_application((select id from public.applications where applications.job_id = settlement_hiring.job_id and kinglancer_id = worker_id), owner_id);
  perform public.offer_role_application((select id from public.applications where applications.job_id = settlement_hiring.job_id and kinglancer_id = worker_id), owner_id);
  assert (select count(*) = 1 from public.engagements where source_kind = 'org_role' and source_id = job_id), 'Role offer retry created another engagement';
  perform public.respond_role_offer(engagement_id,worker_id,'accept');
  perform public.respond_role_offer(engagement_id,worker_id,'accept');
  assert (select status = 'accepted' from public.applications where applications.job_id = settlement_hiring.job_id), 'Role application not accepted';
  assert not has_function_privilege('authenticated', 'public.offer_role_application(uuid,uuid)', 'execute'), 'Authenticated callers can bypass route authorisation';
  assert not has_function_privilege('anon', 'public.respond_role_offer(uuid,uuid,text)', 'execute'), 'Anonymous callers can accept offers';
end $$;
rollback;
