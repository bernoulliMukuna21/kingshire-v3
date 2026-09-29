# Settlement and hiring deployment

Migrations 066–068 were applied to staging project `yvqcdvqmtnypsfjpmjzt` during implementation. Production has not been modified. Types were regenerated using `npm run gen:types` from staging.

## Deployment order

1. Apply 066, 067 and 068 before deploying the matching code. Migration 067 is additive and preserves `cv_url`. Migration 068 adds durable attempt fields, a unique engagement-source index, and service-role-only transactional hiring functions. If the unique index reports duplicates, inspect and reconcile those records before proceeding; do not delete financial history to satisfy the index.
2. Deploy the code and confirm every application instance is using signed CV links. Old and new upload payloads are supported during the transition; new submissions retain legacy URLs as well as object paths.
3. Re-run 067 to backfill any uploads made during deployment, then run `private-cv-cutover.sql` in this directory. This final bucket-privacy switch must follow the application rollout; it is deliberately not part of the ahead-of-code migration. Existing private buckets remain private throughout.
4. Ensure `/api/cron/charge-engagements` runs with `CRON_SECRET`. This is the shared charging/recovery entry point. It repairs accepted schedules, resumes saved attempts and finishes paid-but-unfulfilled records. The old Placement charging endpoint remains compatible but is not a substitute for the recovery sweep.
5. Run the unit suite and the rollback-only staging SQL test in `tests/sql/settlement-hiring.sql`.

## Recovery behaviour

- Checkout and automatic charges atomically reserve the same ledger row. A second click reuses the session. A confirmed expired session releases its reservation; elapsed time alone never does.
- Automatic charging stores an unconfirmed PaymentIntent ID before confirming it. Retries retrieve that same intent rather than create another charge.
- If creation returned no usable identifier, the attempt key may be retried only within 20 hours. Older unidentified attempts remain reserved for investigation because Stripe may prune idempotency keys after 24 hours. Do not reset them to `due` without verifying the Stripe outcome.
- Legacy processing or failed rows without an attempt kind/identifier require reconciliation. The cron reports them rather than risking another payment.
- `fulfilled_at` is set only after payment recording, engagement/Placement activation and role schedule extension succeed. Recovery retries incomplete effects without changing released, disputed or refunded payment states.
- Role acceptance requests period 1. Confirmation of period N requests through N+1. Repeating either operation cannot keep extending the schedule.
- Existing incorrect historical amounts, dates or duplicate Stripe sessions are not silently rewritten. Review those separately against Stripe before any repair.

## Verification

Unit tests cover duplicate checkout requests, interrupted confirmations, old unknown attempts, payment ownership/amount checks, partial fulfilment, fixed schedule targets and legacy CV paths. SQL tests execute in a transaction that rolls back and verify offer retry, seat capacity, atomic role acceptance and signature preservation. They do not send payments or emails.
