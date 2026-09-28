-- Run in BEGIN/ROLLBACK; synthetic business rows only, no external payments.
do $$
declare owner_id uuid; worker_id uuid; job uuid:=gen_random_uuid(); app uuid:=gen_random_uuid();
  attempt uuid:=gen_random_uuid(); payment uuid; outcome jsonb; intent text:='pi_test_'||gen_random_uuid()::text;
begin
  select id into owner_id from public.profiles limit 1;
  select id into worker_id from public.profiles where id<>owner_id limit 1;
  insert into public.jobs(id,client_id,created_by,title,description,budget,status)
    values(job,owner_id,owner_id,'Cancellation fixture','Synthetic regression fixture',100,'open');
  insert into public.applications(id,job_id,kinglancer_id,cover_letter,status) values(app,job,worker_id,'Synthetic application','pending');
  insert into public.payment_attempts(id,job_id,application_id,client_id,kinglancer_id,amount,platform_fee_client,platform_fee_kinglancer,stripe_payment_intent_id)
    values(attempt,job,app,owner_id,worker_id,100,2.5,5,intent);
  begin
    perform public.cancel_open_job(job);
    raise exception using errcode='ZX001',message='Payable checkout allowed cancellation';
  exception when raise_exception then null; end;
  assert (select status='open' from public.jobs where id=job), 'Job changed after blocked cancellation';
  assert (select status='pending' from public.applications where id=app), 'Application changed after blocked cancellation';
  update public.applications set status='rejected' where id=app;
  outcome:=public.finalize_payment_attempt(intent);
  assert outcome->>'result'='applicant_conflict', 'Rejected application accepted';
  assert (select status='open' from public.jobs where id=job), 'Conflict partially advanced job';
  update public.applications set status='pending' where id=app;
  -- Successful funding wins; subsequent success deliveries preserve all states.
  outcome:=public.finalize_payment_attempt(intent);
  assert outcome->>'result'='finalized', 'Funding failed';
  select id into payment from public.transactions where job_id=job;
  update public.transactions set status='released',stripe_transfer_id='tr_fixture' where id=payment;
  perform public.finalize_payment_attempt(intent);
  assert (select status='released' from public.transactions where id=payment), 'Replay rewound released payment';
  update public.transactions set stripe_transfer_id=null where id=payment;
  update public.transactions set status='refunded' where id=payment;
  perform public.finalize_payment_attempt(intent);
  assert (select status='refunded' from public.transactions where id=payment), 'Replay rewound refund';
  -- Cancellation wins after checkout has been definitively cancelled.
  job:=gen_random_uuid(); intent:='pi_test_'||gen_random_uuid()::text;
  insert into public.jobs(id,client_id,created_by,title,description,budget,status)
    values(job,owner_id,owner_id,'Cancellation fixture','Synthetic regression fixture',100,'open');
  insert into public.payment_attempts(job_id,client_id,kinglancer_id,amount,platform_fee_client,platform_fee_kinglancer,stripe_payment_intent_id,status)
    values(job,owner_id,worker_id,100,2.5,5,intent,'cancelled');
  perform public.cancel_open_job(job);
  assert (select status='cancelled' from public.jobs where id=job), 'Cancellation failed';
  begin
    insert into public.payment_attempts(job_id,client_id,kinglancer_id,amount,platform_fee_client,platform_fee_kinglancer,stripe_payment_intent_id)
      values(job,owner_id,worker_id,100,2.5,5,'pi_late_'||job::text);
    raise exception using errcode='ZX001',message='New checkout accepted after cancellation';
  exception when raise_exception then null; end;
  assert not has_function_privilege('authenticated','public.cancel_open_job(uuid)','execute'), 'Cancellation publicly callable';
end $$;
select 'payment cancellation and finalisation assertions passed' as result;
