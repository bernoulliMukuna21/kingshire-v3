-- ============================================================
-- Migration 053: Manual bank-transfer settlement
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- Adds an off-Stripe settlement rail. A client may pay by bank transfer
-- directly to us; an admin then confirms funds received (the equivalent of the
-- payment_intent.succeeded webhook) and later records the manual payout to the
-- worker (the equivalent of fireTransfer). The internal state machine is
-- unchanged — the same transactions row + job status drive every participant's
-- view, so no parallel UI is needed. In manual mode we are the escrow: funds
-- sit with us between 'held' and 'released'.
-- ============================================================

-- 1. transactions: record the rail + manual payout metadata.
alter table public.transactions
  add column if not exists payment_method text not null default 'card'
    check (payment_method in ('card', 'bank_transfer')),
  add column if not exists payout_method text
    check (payout_method is null or payout_method in ('stripe', 'manual')),
  add column if not exists manual_payout_reference text,
  add column if not exists confirmed_by uuid references public.profiles(id);

-- 2. payment_attempts: allow a non-Stripe (bank transfer) attempt.
alter table public.payment_attempts
  add column if not exists method text not null default 'card'
    check (method in ('card', 'bank_transfer'));

-- A bank-transfer attempt has no PaymentIntent, so the id may be null.
alter table public.payment_attempts
  alter column stripe_payment_intent_id drop not null;

-- 3. finalize_manual_payment(attempt_id): the "funds received" trigger.
--    Mirrors finalize_payment_attempt (migration 033) but is keyed on the
--    attempt id and writes a bank_transfer transaction with no PaymentIntent.
--    Same row locks, same authorisation, same applicant/direct-request advance.
create or replace function public.finalize_manual_payment(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt    public.payment_attempts%rowtype;
  v_job        public.jobs%rowtype;
  v_existing   public.transactions%rowtype;
  v_authorised boolean;
  v_reserved   uuid;
  v_accepted   uuid;
begin
  -- 1. Lock the attempt.
  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('result', 'attempt_not_found', 'attempt', null);
  end if;

  if v_attempt.method <> 'bank_transfer' then
    return jsonb_build_object(
      'result', 'not_manual', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- Idempotent for repeated admin confirmations.
  if v_attempt.status <> 'pending' then
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 2. Lock the job, serialising all finalizations for this job.
  select * into v_job from public.jobs where id = v_attempt.job_id for update;
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
    update public.payment_attempts
    set status = 'succeeded', updated_at = now()
    where id = v_attempt.id;
    return jsonb_build_object(
      'result', 'already_finalized', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- 4. Authorise the payer. Personal job: payer must be the owner.
  --    Organisation job: payer must be a current member (mirrors 033).
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

  -- 5. Advance job/applications for the winning worker (mirrors 033).
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

  -- 6. Insert the held escrow transaction (bank_transfer, no PaymentIntent).
  insert into public.transactions (
    job_id, application_id, client_id, kinglancer_id, amount,
    platform_fee_client, platform_fee_kinglancer, payment_method, status
  ) values (
    v_attempt.job_id, v_attempt.application_id, v_attempt.client_id,
    v_attempt.kinglancer_id, v_attempt.amount, v_attempt.platform_fee_client,
    v_attempt.platform_fee_kinglancer, 'bank_transfer', 'held'
  );

  update public.payment_attempts
  set status = 'succeeded', updated_at = now()
  where id = v_attempt.id;

  return jsonb_build_object(
    'result', 'finalized', 'attempt', to_jsonb(v_attempt)
  );

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

-- Only the service role (admin settlement routes) may finalize manual payments.
revoke execute on function public.finalize_manual_payment(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_manual_payment(uuid)
  to service_role;
