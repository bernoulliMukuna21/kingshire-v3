-- ============================================================
-- Migration 033: Atomic payment finalization (audit C3)
-- Run this in Supabase → SQL Editor (STAGING + PROD)
-- ============================================================
--
-- finalizePaymentAttempt() previously advanced payment attempts, jobs,
-- applications and transactions across several independent PostgREST calls.
-- Promise.all is concurrency, not atomicity: a crash or race between calls
-- could leave a funded Stripe payment with partially-advanced internal state.
--
-- This function performs the whole transition inside ONE transaction with row
-- locks:
--   * lock the payment attempt (by PaymentIntent id);
--   * lock the job (serialising all finalizations for that job);
--   * validate current states and authorise the payer (personal owner, or any
--     current organisation member — mirrors canManageJob / ORG-J08);
--   * reserve/select the worker and reject competing applications;
--   * insert the unique escrow transaction;
--   * mark the attempt succeeded;
--   * commit once.
--
-- Stripe stays external, so the caller keeps using PaymentIntent idempotency
-- and treats "already_finalized" as success so retries stop.
--
-- Returns jsonb: { "result": <code>, "attempt": <payment_attempts row | null> }
-- ============================================================

create or replace function public.finalize_payment_attempt(
  p_payment_intent_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt     public.payment_attempts%rowtype;
  v_job         public.jobs%rowtype;
  v_existing    public.transactions%rowtype;
  v_authorised  boolean;
  v_reserved    uuid;
  v_accepted    uuid;
begin
  -- 1. Lock the attempt. Two deliveries of the same PaymentIntent serialise
  --    here because stripe_payment_intent_id is unique.
  select * into v_attempt
  from public.payment_attempts
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  -- Legacy fallback: pending transactions created before payment_attempts.
  if not found then
    update public.transactions
    set status = 'held'
    where stripe_payment_intent_id = p_payment_intent_id
      and status = 'pending';
    return jsonb_build_object('result', 'legacy_no_attempt', 'attempt', null);
  end if;

  -- 2. Lock the job, serialising all finalizations for this job.
  select * into v_job
  from public.jobs
  where id = v_attempt.job_id
  for update;

  if not found then
    return jsonb_build_object(
      'result', 'job_not_found', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 3. Idempotency: a transaction may already exist for this job.
  select * into v_existing
  from public.transactions
  where job_id = v_attempt.job_id;

  if found then
    if v_existing.stripe_payment_intent_id is not null
       and v_existing.stripe_payment_intent_id <> p_payment_intent_id then
      return jsonb_build_object(
        'result', 'different_payment', 'attempt', to_jsonb(v_attempt)
      );
    end if;

    update public.transactions
    set status = 'held', stripe_payment_intent_id = p_payment_intent_id
    where id = v_existing.id;

    update public.payment_attempts
    set status = 'succeeded', updated_at = now()
    where id = v_attempt.id;

    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 4. Authorise the payer. Personal job: payer must be the owner.
  --    Organisation job: payer must be a current member (every member role
  --    holds manage_jobs, so membership existence is sufficient).
  if v_job.organisation_id is null then
    v_authorised := (v_job.client_id = v_attempt.client_id);
  else
    v_authorised := exists (
      select 1
      from public.organisation_members m
      join public.organisations o on o.id = m.organisation_id
      where m.organisation_id = v_job.organisation_id
        and m.user_id = v_attempt.client_id
        and o.deleted_at is null
    );
  end if;

  if not v_authorised then
    return jsonb_build_object(
      'result', 'unauthorised', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 5. Advance job/applications for the winning worker.
  if v_attempt.attempt_type = 'application' then
    if v_attempt.application_id is null then
      return jsonb_build_object(
        'result', 'application_missing_id', 'attempt', to_jsonb(v_attempt)
      );
    end if;

    if v_job.status = 'open' then
      update public.jobs
      set status = 'in_progress', kinglancer_id = v_attempt.kinglancer_id
      where id = v_job.id
        and status = 'open'
        and kinglancer_id is null
      returning id into v_reserved;

      if v_reserved is null then
        return jsonb_build_object(
          'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.applications
      set status = 'accepted'
      where id = v_attempt.application_id
        and job_id = v_job.id
        and status = 'pending'
      returning id into v_accepted;

      if v_accepted is null then
        return jsonb_build_object(
          'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.applications
      set status = 'rejected'
      where job_id = v_job.id
        and id <> v_attempt.application_id
        and status = 'pending';

    elsif v_job.status <> 'in_progress'
          or v_job.kinglancer_id is distinct from v_attempt.kinglancer_id then
      return jsonb_build_object(
        'result', 'applicant_conflict', 'attempt', to_jsonb(v_attempt)
      );
    end if;

  else
    -- Direct request.
    if v_job.status = 'open' then
      if v_job.invited_kinglancer_id is distinct from v_attempt.kinglancer_id
         or v_job.direct_request_status <> 'accepted_pending_payment' then
        return jsonb_build_object(
          'result', 'direct_not_ready', 'attempt', to_jsonb(v_attempt)
        );
      end if;

      update public.jobs
      set status = 'in_progress',
          kinglancer_id = v_attempt.kinglancer_id,
          direct_request_status = null
      where id = v_job.id
        and status = 'open'
        and direct_request_status = 'accepted_pending_payment'
        and invited_kinglancer_id = v_attempt.kinglancer_id
      returning id into v_reserved;

      if v_reserved is null then
        return jsonb_build_object(
          'result', 'direct_conflict', 'attempt', to_jsonb(v_attempt)
        );
      end if;

    elsif v_job.status <> 'in_progress'
          or v_job.kinglancer_id is distinct from v_attempt.kinglancer_id then
      return jsonb_build_object(
        'result', 'direct_changed', 'attempt', to_jsonb(v_attempt)
      );
    end if;
  end if;

  -- 6. Insert the unique escrow transaction and mark the attempt succeeded.
  insert into public.transactions (
    job_id, application_id, client_id, kinglancer_id, amount,
    platform_fee_client, platform_fee_kinglancer, stripe_payment_intent_id,
    status
  ) values (
    v_attempt.job_id, v_attempt.application_id, v_attempt.client_id,
    v_attempt.kinglancer_id, v_attempt.amount, v_attempt.platform_fee_client,
    v_attempt.platform_fee_kinglancer, p_payment_intent_id, 'held'
  );

  update public.payment_attempts
  set status = 'succeeded', updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object('result', 'finalized', 'attempt', to_jsonb(v_attempt));

exception
  when unique_violation then
    -- A concurrent finalization already inserted the transaction. Idempotent.
    update public.payment_attempts
    set status = 'succeeded', updated_at = now()
    where id = v_attempt.id;
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
end;
$$;

-- Only the service role (webhooks, crons, server routes) may finalize payments.
revoke execute on function public.finalize_payment_attempt(text)
  from public, anon, authenticated;
grant execute on function public.finalize_payment_attempt(text)
  to service_role;
