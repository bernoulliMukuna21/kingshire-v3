-- ============================================================
-- Migration 059: Espees (ESP) payment rail — inbound escrow funding
-- Run in Supabase → SQL Editor (STAGING first, then PROD)
-- ============================================================
--
-- Adds Espees as a third escrow-funding rail alongside card (Stripe) and bank
-- transfer. Espees is redirect-based like Stripe Checkout but self-confirms via
-- the /v2/payment/confirm endpoint (no webhook), so mechanically it mirrors the
-- bank-transfer path (keyed on the attempt id, no PaymentIntent) while being
-- auto-confirmed on redirect-back rather than by an admin. Funds land in our
-- Espees merchant wallet, so — like bank transfer — we are the escrow.
--
-- The internal state machine is unchanged: the same transactions row + job
-- status drive every view, so no parallel UI is needed. Additive and
-- backward-compatible.
-- ============================================================

-- 1. transactions: allow the espees rail.
alter table public.transactions
  drop constraint if exists transactions_payment_method_check;
alter table public.transactions
  add constraint transactions_payment_method_check
    check (payment_method in ('card', 'bank_transfer', 'espees'));

-- 2. payment_attempts: allow an espees attempt + record the Espees reference and
--    the ESP amount actually charged (informational/reconciliation — all fee and
--    payout maths stay GBP-denominated on `amount`).
alter table public.payment_attempts
  drop constraint if exists payment_attempts_method_check;
alter table public.payment_attempts
  add constraint payment_attempts_method_check
    check (method in ('card', 'bank_transfer', 'espees'));

alter table public.payment_attempts
  add column if not exists espees_payment_ref text,
  add column if not exists espees_amount numeric(14, 2);

-- 3. Generalise finalize_manual_payment to take the rail. Existing callers pass
--    only the attempt id and get the default 'bank_transfer'; the espees confirm
--    route passes 'espees'. The body is identical to migration 053 except the
--    inserted payment_method is the parameter and the rail guard accepts it.
drop function if exists public.finalize_manual_payment(uuid);

create function public.finalize_manual_payment(
  p_attempt_id uuid,
  p_method text default 'bank_transfer'
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
  if p_method not in ('bank_transfer', 'espees') then
    return jsonb_build_object('result', 'unsupported_method', 'attempt', null);
  end if;

  -- 1. Lock the attempt.
  select * into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('result', 'attempt_not_found', 'attempt', null);
  end if;

  if v_attempt.method <> p_method then
    return jsonb_build_object(
      'result', 'not_manual', 'attempt', to_jsonb(v_attempt)
    );
  end if;

  -- Idempotent for repeated confirmations.
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

  -- 6. Insert the held escrow transaction on the given rail (no PaymentIntent).
  insert into public.transactions (
    job_id, application_id, client_id, kinglancer_id, amount,
    platform_fee_client, platform_fee_kinglancer, payment_method, status
  ) values (
    v_attempt.job_id, v_attempt.application_id, v_attempt.client_id,
    v_attempt.kinglancer_id, v_attempt.amount, v_attempt.platform_fee_client,
    v_attempt.platform_fee_kinglancer, p_method, 'held'
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

-- Only the service role (settlement routes) may finalize.
revoke execute on function public.finalize_manual_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_manual_payment(uuid, text)
  to service_role;
