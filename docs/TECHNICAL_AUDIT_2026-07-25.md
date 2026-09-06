# KingsHire repository-wide technical audit

Date: 25 July 2026

Scope: the Next.js application, API routes, Supabase schema and all migrations,
Stripe/payment paths, scheduled jobs, authentication, email, deployment
configuration, and automated tests. The uncommitted Organisation Phase 1 work
is included.

This is primarily a repository/static audit. It identifies what the checked-in
code and migrations would do, but it does not prove that staging or production
currently has identical policies, grants, indexes, configuration, or data.
Deployment-dependent findings are explicitly marked for verification below.

## Executive assessment

The repository is a workable MVP, but it is not yet an appropriate foundation
for a high-availability financial marketplace at scale. The main problem is
not algorithmic code in isolation. It is that financial state changes are
distributed across multiple HTTP/database calls, privileged database access is
used broadly, background work is unbounded, and several important invariants
are enforced only by application code.

Do not rewrite the UI wholesale. Preserve the product flows and incrementally
replace the data and domain layer behind them. The immediate goal should be a
safe modular monolith with PostgreSQL as the transactional source of truth,
durable asynchronous jobs, thin Next.js adapters, and explicit domain
boundaries. Microservices would add failure modes and operational cost without
solving the present problems.

The recommendations are intentionally sequenced. Money, authorization, and
data-integrity defects come first. Scale-oriented infrastructure should be
introduced when current usage, near-term product limits, or measured query
plans justify it—not merely because it would be ideal in a much larger system.

## Evidence and severity convention

- **Confirmed code defect:** directly demonstrated by the current application
  code and relevant to a current or Phase 1 flow.
- **Deployment verification required:** the repository indicates a potentially
  critical condition, but deployed database/configuration state must be
  inspected before asserting that it is live.
- **Growth improvement:** a valid scalability or operational improvement whose
  timing should be driven by product limits, measurements, and usage.
- **Target architecture:** direction that keeps current work coherent; it is
  not automatically a prerequisite for the next release.

## Release blockers and pre-release verification

### C1 — `SECURITY DEFINER` execution grants may be unsafe

**Evidence status: deployment verification required.**

PostgreSQL grants function execution to `PUBLIC` by default. Several migrations
create privileged functions without immediately revoking execution from
`PUBLIC`, `anon`, and `authenticated`.

Examples include:

- `increment_jobs_completed(user_id)` in migration 015;
- `recompute_profile_rating(target)` and `reveal_expired_reviews()` in
  migration 026;
- `get_client_stats(p_client_id)` and
  `get_kinglancer_stats(p_kinglancer_id)` in migration 028.

If deployed grants match these migrations, consequences may include forged
completion counts, unauthorized recomputation or mutation, triggering review
publication, and disclosure of another user's financial aggregates through RPC
calls. Manual changes may already have restricted the deployed functions, so
this must be checked rather than assumed.

Required response:

1. Inventory every function and its actual grants in staging/production.
2. If unintended execution is present, treat it as a release blocker and
   revoke access immediately.
3. Regardless of deployed state, correct the migrations so a fresh environment
   is secure and reproducible.
4. Grant only to `service_role`, or make a user-facing function derive the
   actor from `auth.uid()` and authorize internally.
5. Set a safe `search_path` on every security-definer function.
6. Add automated privilege tests.

Initial deployed-state check:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege(
    'authenticated', p.oid, 'EXECUTE'
  ) as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;
```

This query reports privileges; it does not by itself prove exploitability.
Review each function body, ownership, argument handling, and authorization
logic before deciding remediation.

### C2 — Organisation payments cannot safely be finalized by a colleague

**Evidence status: confirmed code defect.**

An Organisation member can initiate payment, and the payment attempt records
that member as `client_id`. `finalizePaymentAttempt()` then requires the
attempt's client to equal `jobs.client_id`, which remains the original job
poster. A colleague paying for an Organisation job therefore reaches a
post-payment finalization conflict.

Financial ownership must be modeled explicitly. A transaction needs
`organisation_id`, plus separate `payer_user_id` and creator/audit fields.
Finalization must authorize the payer against the Organisation and validate
immutable Stripe metadata, not overload the personal `client_id`.

### C3 — Payment finalization is not one database transaction

**Evidence status: confirmed code defect in a financial path.**

`finalizePaymentAttempt()` reads and updates payment attempts, jobs,
applications, and transactions through multiple independent calls.
`Promise.all()` is concurrency, not atomicity. A crash or race between calls
can leave a funded Stripe payment with partially advanced internal state.

Move finalization to one locked PostgreSQL transaction/RPC:

- lock the payment attempt and job;
- validate the expected current states;
- reserve/select the worker;
- reject competing applications;
- insert the unique transaction;
- mark the attempt succeeded;
- write an outbox event;
- commit once.

Stripe remains external, so use idempotency keys and reconciliation rather than
pretending Stripe and PostgreSQL share a transaction.

### C4 — Auto-release reads jobs using an unauthenticated RLS client

**Evidence status: confirmed code defect; an environment integration test must
confirm its deployed effect.**

The auto-release cron constructs the normal cookie-based Supabase client and
uses it to find completed jobs. A cron request has no user session, so the
query is governed by anonymous RLS and may return no eligible completed jobs.
The rest of the route uses the service client.

Use a purpose-built privileged background-job context consistently and add an
integration test proving that an eligible held transaction is released.

### C5 — Organisation creation and invitation acceptance are non-atomic

**Evidence status: confirmed code defect relevant to Organisation Phase 1.**

Organisation creation inserts the Organisation and Owner separately, then
attempts compensating deletion. Invitation acceptance inserts membership and
marks the invitation accepted separately without checking the second update.

Both flows need transactional database commands with row locking and invariant
checks. There must always be exactly one Organisation Owner.

**Working-tree status:** addressed in the unapplied migration 029 through
service-only transactional functions. It remains open until the migration and
integration scenarios pass in a test Supabase environment.

## High-priority findings

These findings are important to the platform direction, but they are not all
automatic blockers for the next release. Their timing is refined in
“Practical priority and timing.”

### H1 — Service-role access is the normal data path

The service role is used throughout public pages, dashboards, domain helpers,
payments, notifications, and API routes. It bypasses RLS, making every route
authorization check a single point of failure.

Use authenticated RLS for ordinary reads and user-owned writes. Reserve
service-role access for webhooks, workers, administration, and narrowly scoped
domain commands. Privileged commands must authorize internally and expose
small interfaces.

### H2 — Missing and mismatched Organisation indexes

The membership primary key `(organisation_id, user_id)` supports member lists
and membership checks, but not the workspace lookup by `user_id`.

Add:

```sql
create index organisation_members_user_joined_idx
  on organisation_members (user_id, joined_at);

create index jobs_organisation_created_at_idx
  on jobs (organisation_id, created_at desc);
```

Retain the status-specific Organisation job index for active-job queries.

**Working-tree status:** both recommended indexes are now included in the
unapplied migration 029.

### H3 — Organisation transaction queries are unbounded and use large ID lists

The transaction screen first loads all Organisation job IDs and then sends
them back through an `.in(...)` filter. Time and memory are O(J + T), and large
requests can exceed API limits.

Use one joined, cursor-paginated query. Target O(page_size) application memory
and O(log N + page_size) indexed database work.

**Working-tree status:** replaced with one joined query bounded to 50 rows per
page. It currently uses page/range pagination; cursor pagination can replace it
when measured depth or write volume justifies that added complexity.

### H4 — Organisation dashboard aggregates are incorrect

The dashboard loads the latest 50 jobs and computes the job count and released
spend from only those jobs. These figures become incorrect after job 50.

Calculate counts and sums in PostgreSQL, returning one aggregate row. Fetch the
latest job page independently.

**Working-tree status:** addressed through the service-only
`get_organisation_stats` database function; the latest jobs query is now
independent and bounded to 20 rows.

### H5 — Scheduled jobs perform unbounded scans and serial N+1 work

Auto-release, cleanup, expiry, Stripe account updates, and review notification
paths load all matching rows. Several then perform one or more queries and
external API calls per row.

Use:

- indexed eligibility columns;
- fixed-size batches;
- `FOR UPDATE SKIP LOCKED` claims;
- maximum execution budgets;
- bounded concurrency for external calls;
- durable retry state and dead-letter handling;
- continuation cursors.

### H6 — Email and notification delivery is not durable

Many requests commit business state and then fire email promises without
awaiting or persisting delivery work. Process termination can silently lose
notifications. Brevo calls also sit on request/cron critical paths in places.

Write an outbox record in the same database transaction as the business event.
A worker should deliver it with retry, backoff, deduplication, and a
dead-letter state.

### H7 — No rate-limiting layer

Authentication attempts, admin passcode attempts, invitations, Organisation
creation, jobs, applications, disputes, payment setup, and email-producing
actions lack rate limits.

Apply per-user, per-Organisation, per-IP and destination-email limits as
appropriate. Store counters in a shared service; in-process counters do not
work across replicas.

### H8 — Admin authentication is not operationally strong enough

The admin layer uses the normal account plus one shared passcode and a custom
signed cookie. There is no attempt throttling, per-admin MFA requirement,
session revocation, device/session inventory, or audit log.

Use Supabase identity plus an immutable admin entitlement and MFA. Maintain
short-lived, revocable sessions and audit every privileged action.

### H9 — HTML email content is interpolated without escaping

Job titles, names, dispute reasons, and other user-originated strings are
inserted into HTML templates. This permits HTML injection in email content.

Escape all text values, construct links from allow-listed schemes/hosts, and
keep trusted markup separate from untrusted content.

### H10 — Production health checking is superficial

`/api/health` returns success without checking database connectivity,
migration compatibility, or critical configuration. A process can be marked
healthy while unable to serve authenticated or payment traffic.

Provide:

- liveness: process is running;
- readiness: required configuration and a bounded database query succeed;
- separate dependency telemetry for Stripe, Brevo, and Supabase;
- startup migration/version compatibility checks.

## Medium-priority findings

### M1 — Validation is duplicated and weak

Routes manually parse JSON and validate values with checks such as
`email.includes("@")`. Limits and accepted values differ between create and
update paths.

Use shared schemas for request, domain-command, and database boundaries.
Return consistent structured errors and reject oversized fields.

### M2 — Authentication and authorization boilerplate is repeated

Routes repeatedly create clients, fetch users, fetch profiles/memberships, and
construct slightly different 401/403 responses.

Introduce:

- `requireUser()`;
- `requirePersonalRole()`;
- `requireOrganisationActor(permission)`;
- `requireAdmin()`;
- a single typed API error mapper.

### M3 — Role checks and permission checks are mixed

Some UI and API paths compare role strings directly while others use the
Organisation permission map. Centralize policy decisions so adding future
roles cannot create divergent behavior.

### M4 — Generated database typing has drifted

Numerous `as unknown as` and `as any` casts bypass compiler guarantees.
`schema.sql`, migrations, and `lib/supabase/types.ts` are maintained manually
and are already out of sync with Organisation migration 029.

Make migrations authoritative, regenerate database types in CI, and fail CI
when generated output differs.

### M5 — Domain logic is spread across routes and database helpers

Payment, job-state, notification, authorization, and persistence operations
are mixed in large route handlers. Similar manual and automatic release flows
have separate implementations and can drift.

Create domain modules for identity, organisations, jobs, hiring, payments,
payouts, reviews, notifications, and administration. HTTP handlers should
validate input, call one application command, and map the result.

### M6 — Public list limits silently truncate rather than paginate

Several pages use fixed limits of 100 or 200. This bounds memory, which is
good, but silently hides older data or produces incorrect totals.

Use cursor pagination for user-facing lists and SQL aggregates for totals.

### M7 — Error handling often collapses failures into “not found”

Database helpers return `null` for both missing records and database errors.
This hides outages and produces misleading 404 responses.

Use typed outcomes: found, not found, forbidden, conflict, dependency failure,
and unexpected failure. Log structured correlation IDs.

### M8 — Observability is console-only

There is no structured logging contract, metrics, tracing, error aggregation,
business reconciliation dashboard, or alert policy.

At minimum measure:

- request latency/error rate by route;
- Supabase/Stripe/Brevo latency and failures;
- webhook age and retry count;
- pending/held/released payment state counts;
- stuck payment attempts and outbox messages;
- cron last success and rows processed;
- authorization denials and admin activity.

### M9 — Availability depends on single external services and one app service

Railway restarts the process, but there is no evidence of multiple replicas,
multi-zone placement, tested backups/restores, migration rollback discipline,
or recovery objectives.

Define realistic initial targets such as 99.9% monthly availability, RPO of 15
minutes, and RTO of 60 minutes. Confirm Supabase and Railway plans can support
them. Test restore procedures; a backup that has never been restored is not a
verified recovery mechanism.

### M10 — Tests are too shallow for the risk profile

There are 27 unit tests and mostly unauthenticated browser smoke tests. Critical
authorization, RLS, concurrent payment, webhook retry, cron, Organisation
membership, and migration behavior are not exercised against a real test
database.

Add:

- migration/privilege tests;
- RLS tests using anon, user, Organisation member, outsider, admin, and service
  credentials;
- transactional integration tests;
- Stripe webhook replay/concurrency tests;
- contract tests for Brevo/Stripe boundaries;
- Playwright journeys with isolated seeded accounts;
- load tests for browsing, dashboards, job posting, and applications.

## Practical priority and timing

The severity of a finding and the timing of its full architectural solution are
not always the same. The smallest reliable correction should ship first; a
larger platform capability should follow only when it solves a demonstrated or
near-term problem.

### Fix before Organisation Phase 1 release

- Verify deployed `SECURITY DEFINER` grants and correct the migrations.
- Fix Organisation payment ownership and finalization.
- Fix the auto-release database context.
- Make Organisation creation and invitation acceptance atomic.
- Escape untrusted HTML email content.
- Add the missing membership lookup index.
- Correct Organisation dashboard aggregates.
- Add database-backed authorization and concurrency regression tests for these
  paths.

### Verify now and act on evidence

- Compare deployed RLS policies, function grants, indexes, and migration
  versions with the repository.
- Examine Stripe webhook retries and reconcile payment attempts, transactions,
  and jobs for inconsistent states.
- Confirm cron last-success times and prove each cron with a seeded integration
  scenario.
- Obtain query plans for the busiest dashboard, job browse, application, and
  notification queries using production-like cardinalities.
- Confirm backup retention and perform a restoration test before claiming an
  RPO or RTO.

### Complete before meaningful growth

- Paginate growing job, transaction, member, and admin lists.
- Batch scheduled work and notifications with bounded concurrency.
- Add shared rate limiting to abuse-sensitive endpoints.
- Introduce audit logs, structured monitoring, and payment reconciliation.
- Centralize validation, authentication, authorization, and API errors.
- Regenerate database types and reduce privileged service-role access.
- Make critical notifications durable.

### Adopt only when justified

- Multiple application replicas when traffic or availability targets require
  them.
- Dedicated worker infrastructure when database-backed jobs no longer meet
  throughput or isolation needs.
- Distributed tracing when simpler structured logs and metrics cannot explain
  production behavior.
- Read replicas, multi-region deployment, or microservices only after measured
  bottlenecks or recovery requirements justify their cost.

For every proposed change, record:

1. the current or near-term failure it prevents;
2. the evidence that the condition exists;
3. the smallest safe intervention;
4. the test or measurement that proves improvement;
5. the operational and maintenance cost introduced.

## Complexity targets

Big-O is not the only performance measure; network round trips and transferred
rows dominate this application. The following targets are appropriate:

| Operation | Current tendency | Target |
|---|---:|---:|
| Workspace switcher | O(user memberships) rows per dashboard request | O(1), fixed small limit |
| Organisation member lookup | index mismatch when filtering by user | O(log M) |
| Organisation jobs | fixed 50 with incorrect totals | O(log J + page size) |
| Organisation transactions | O(J + T), large `IN` list | O(log T + page size) |
| Dashboard totals | O(rows transferred) in some paths | O(1) response memory, SQL aggregate |
| Cron processing | O(all eligible rows), serial N+1 | O(batch size), bounded concurrency |
| Job alerts | O(all matched users) in request path | O(batch size) asynchronously |
| Payment finalization | multiple round trips and race windows | one locked DB transaction |

Indexes trade write cost and disk space for read speed. Only add indexes tied to
observed query shapes, and verify them with `EXPLAIN (ANALYZE, BUFFERS)` on
production-like volumes.

## Recommended target architecture

Use a modular monolith:

```text
app/                         Next.js pages and thin route adapters
modules/
  identity/
  organisations/
  jobs/
  hiring/
  payments/
  payouts/
  reviews/
  notifications/
  administration/
infrastructure/
  supabase/
  stripe/
  brevo/
  observability/
workers/
  outbox/
  payments/
  notifications/
```

Each module should contain:

- schemas and domain types;
- authorization policies;
- application commands and queries;
- repository interfaces;
- integration tests.

The database should own hard invariants and transactional state transitions.
Next.js should own presentation and request orchestration. Workers should own
retryable external side effects.

## Availability design

High availability here means graceful degradation and recovery, not merely
running more web replicas.

- Web instances must be stateless.
- Sessions and rate limits must use shared stores.
- Every external mutation needs an idempotency key.
- Webhook events need a durable receipt/deduplication table.
- Outbox workers need leases, retries, and dead-letter states.
- Cron work must be batchable and safe under overlapping execution.
- Payment reconciliation must compare Stripe and local state periodically.
- Deployments need backward-compatible expand/migrate/contract database
  changes.
- Readiness must prevent traffic reaching incompatible application versions.
- Backups, restore drills, RPO and RTO must be documented.

## Refactoring programme

### Stage 0 — security containment

1. Audit and revoke unsafe function grants.
2. Fix Organisation payment ownership/finalization.
3. Fix the auto-release database client.
4. Escape email HTML.
5. Add rate limiting to admin and email-producing endpoints.
6. Add regression tests before deploying Organisation Phase 1.

### Stage 1 — transactional integrity

1. Atomic payment finalization.
2. Atomic Organisation creation/invitation acceptance/ownership.
3. Payment/webhook receipt ledger and reconciliation.
4. Transactional outbox.

### Stage 2 — query scalability

1. Missing indexes.
2. SQL aggregates.
3. Cursor pagination.
4. Batched workers with bounded concurrency.
5. Query-plan tests using production-like data volumes.

### Stage 3 — maintainability

1. Shared validation and error contracts.
2. Central authentication/authorization contexts.
3. Domain modules and repositories.
4. Generated database types.
5. Remove unsafe casts and duplicated release/payment logic.

### Stage 4 — operational reliability

1. Structured logs, tracing, metrics and alerts.
2. Readiness/liveness separation.
3. Tested backups and restore runbooks.
4. Staging migration pipeline and rollback/forward-fix drills.
5. Load, soak and failure-injection testing.

## Deliberate compromises

- Keep Next.js and Supabase; replacing them would consume time without fixing
  the domain and transaction problems.
- Prefer a modular monolith over microservices until independent scaling or
  team ownership proves necessary.
- Use PostgreSQL-backed outbox/worker tables initially instead of introducing
  Kafka or another distributed platform.
- Use cursor pagination where growth is expected; simple bounded lists are
  acceptable where product limits guarantee small cardinality.
- Target 99.9%, not “five nines,” until revenue and operational staffing
  justify multi-region complexity.

## Definition of “moving in the correct direction”

Before calling the foundation scalable and secure:

- no privileged function is unintentionally executable;
- every money state transition is transactional and idempotent;
- every list is bounded or paginated;
- every aggregate is calculated in the database;
- every common query has a verified index/query plan;
- privileged access is centralized and audited;
- external side effects are durable and retryable;
- critical flows have real database integration and concurrency tests;
- restore, reconciliation, and incident procedures have been exercised.
