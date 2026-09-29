# Reconciling uncertain settlements

An outgoing transfer or refund reservation never expires automatically. A timeout,
process crash, or failed database write does not establish whether money moved.
Do not clear reservations or issue a compensating refund to test the outcome.

For an existing successful Stripe transfer/refund, an authenticated administrator
with a valid admin session can POST to `/api/admin/settlement/<paymentId>/reconcile`
with JSON `{ "externalId": "tr_..." }` or `{ "externalId": "re_..." }`.
This only retrieves the Stripe object, verifies its relationship and amount, and
records the outcome. It never creates a transfer or refund. Conflicting outcomes
and pending/partial refunds remain blocked for investigation.

Inspect `engagement_payments.release_operation`, `release_attempt_started_at`,
`stripe_transfer_id`, `stripe_refund_id`, and `settlement_error` for pending work.
If no successful external outcome can be established, leave the reservation in
place and investigate with Stripe. Never infer failure from reservation age.

Apply migrations 069–073 to staging before deployment; 073 depends on 071.
Verify permissions and lifecycle transitions using the SQL regression script.
Production rollout is separate; this change does not initiate payments.

## Recovery controls (migration 074)

Use **Admin → Settlement recovery** for both one-off transactions and engagement
payments. A valid admin session and a reason are required; actions retain the
previous state in `settlement_recovery_audit`.

- **Reset unsuccessful attempt** is available only before dispatch, or after a
  persisted Stripe insufficient-balance rejection. It fences the old worker and
  allows the normal settlement workflow to reserve a new attempt. It does not
  itself move money. Legacy reservations with unknown outcomes cannot be reset.
- **Retry saved Stripe request** replays the stored payload and original key,
  within 20 hours of dispatch. It can complete a transfer or refund. Outside that
  window, verify an existing Stripe outcome instead. Stripe documents key
  retention of at least 24 hours: https://docs.stripe.com/api/idempotent_requests.
- **Verify and record existing outcome** retrieves and validates an existing
  Stripe transfer/refund. It does not initiate payment.
- **Resume settlement** clears an active engagement hold only after disputed,
  failed, processing and uncertain payments have been resolved. Subsequent normal
  settlement runs can then continue.

The controls use `POST /api/admin/settlement/recover`. Apply 074 after 073 before
running the new settlement code. The SQL regression script
`tests/sql/job-settlement-recovery.sql` must be wrapped in BEGIN/ROLLBACK; it creates
synthetic business records and makes no Stripe calls.
