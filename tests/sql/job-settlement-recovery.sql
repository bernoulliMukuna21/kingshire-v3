-- Execute within a transaction and roll back. Only synthetic business records.
do $$
declare owner_id uuid; worker_id uuid; admin_id uuid; job uuid := gen_random_uuid(); payment uuid := gen_random_uuid();
  row1 public.transactions; row2 public.transactions; stale uuid; n int;
begin
  select id into owner_id from public.profiles order by id limit 1;
  select id into worker_id from public.profiles where id <> owner_id order by id limit 1;
  select id into admin_id from public.profiles where role='admin' limit 1;
  if admin_id is null or worker_id is null then raise exception 'Staging fixtures require an admin and two profiles'; end if;
  insert into public.jobs(id,client_id,created_by,kinglancer_id,title,description,budget,status)
    values(job,owner_id,owner_id,worker_id,'Rollback settlement test','Synthetic test',100,'completed');
  insert into public.transactions(id,job_id,client_id,kinglancer_id,amount,platform_fee_client,platform_fee_kinglancer,stripe_payment_intent_id,status)
    values(payment,job,owner_id,worker_id,100,2.5,5,'pi_test_'||payment::text,'held');
  row1 := public.reserve_job_settlement(payment,'transfer');
  assert row1.release_attempt_id is not null, 'No reservation';
  row2 := public.reserve_job_settlement(payment,'transfer');
  assert row2.id is null, 'Duplicate reservation';
  -- No old worker can dispatch after an administrator resets the preparation.
  stale := row1.release_attempt_id;
  perform public.reset_settlement_reservation('transactions',payment,stale,admin_id,'Reset a crashed preparation');
  update public.transactions set release_outcome='dispatched' where id=payment and release_attempt_id=stale and release_outcome='reserved';
  get diagnostics n = row_count;
  assert n=0, 'Stale worker was able to dispatch';
  row1 := public.reserve_job_settlement(payment,'transfer');
  update public.transactions set release_outcome='dispatched',release_dispatch_started_at=now() where id=payment;
  begin
    perform public.reset_settlement_reservation('transactions',payment,row1.release_attempt_id,admin_id,'Cannot reset unknown outcomes');
    raise exception using errcode='ZX001',message='Unknown outcome reset';
  exception when raise_exception then null; end;
  update public.transactions set release_outcome=null where id=payment;
  begin
    perform public.reset_settlement_reservation('transactions',payment,row1.release_attempt_id,admin_id,'Legacy outcomes stay blocked');
    raise exception using errcode='ZX001',message='Legacy outcome reset';
  exception when raise_exception then null; end;
  update public.transactions set release_outcome='failed',release_failure_code='balance_insufficient' where id=payment;
  perform public.reset_settlement_reservation('transactions',payment,row1.release_attempt_id,admin_id,'Stripe confirmed no movement');
  row1 := public.reserve_job_settlement(payment,'transfer');
  begin
    perform public.raise_job_dispute(job,owner_id,'Dispute racing a transfer');
    raise exception using errcode='ZX001',message='Dispute ignored transfer reservation';
  exception when raise_exception then null; end;
  begin
    update public.transactions set manual_payout_reference='unexpected',status='released' where id=payment;
    raise exception using errcode='ZX001',message='Manual payout bypassed reservation';
  exception when raise_exception then null; end;
  row2 := public.finish_job_settlement(payment,row1.release_attempt_id,'tr_test_'||payment::text);
  assert row2.status='released' and (select status='approved' from public.jobs where id=job), 'Finalisation not atomic';
  row2 := public.reserve_job_settlement(payment,'refund');
  assert row2.id is null, 'Refund allowed after transfer';
  assert (select count(*)=2 from public.settlement_recovery_audit where payment_id=payment and action='reset'), 'Missing audit trail';
  assert not has_function_privilege('authenticated','public.reset_settlement_reservation(text,uuid,uuid,uuid,text)','execute'), 'Reset publicly callable';
end $$;
select 'job settlement and recovery assertions passed' as result;
