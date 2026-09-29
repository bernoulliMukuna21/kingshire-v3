# Organisation Jobs Redesign

Status: **Design in progress**

Started: 21 September 2026

## Purpose

Organisation jobs currently use the ordinary one-off gig flow. That is the wrong
product model for ongoing organisational roles. This redesign introduces a
separate Organisation role surface while reusing one domain-agnostic recurring
settlement engine with Placements.

The goal is a scalable, reliable model with one implementation of recurring
billing, escrow, payout, cadence handling and fee calculation. Organisation
roles must not be bolted onto the Placement UI or duplicated as a second
payment system.

## Product Model

Organisation members will be able to choose between two kinds of posting:

1. **One-off gig**
   - Existing fixed-budget job flow.
   - One-off escrow payment and payout.
   - Applies to personal jobs and Organisation jobs that remain ordinary gigs.

2. **Recurring Organisation role**
   - Separate Organisation-facing posting flow and presentation.
   - Modelled as a paid role, not as a Placement.
   - Uses the shared recurring settlement engine.
   - Can be **permanent** or **temporary**.
   - Supports **weekly** or **monthly** pay.
   - Has no mandatory end date for permanent roles.
   - Temporary roles may use a bounded duration.
   - Compensation is money only.
   - The Organisation may choose **Discuss pay at interview**.

Recurring roles will not appear as Placements. The code may reuse the same
settlement engine, but the product surfaces, language, permissions and domain
records remain distinct.

## Payment Modes

### Managed payment

The Organisation declares the worker amount and cadence. The platform:

1. Charges the Organisation's saved Stripe payment method for each period.
2. Holds the worker amount in escrow.
3. Releases the worker's net amount at the end of that same weekly or monthly
   period.
4. Applies the existing fee model:
   - client/platform fee: 2.5%
   - Kinglancer fee: 5%

Billing cadence and payout cadence are the same. Daily billing is intentionally
not supported because repeated Stripe fixed charges could consume the platform
margin.

### Direct / discussed payment

The Organisation and Kinglancer agree the pay during the interview. The payment
is made outside KingsHire, but the Organisation declares the agreed amount and
cadence at hire so the platform can calculate its facilitation fee.

The platform charges the Organisation a fee equivalent to what it would have
earned from a managed payment:

- 2.5% client-side fee
- 5% Kinglancer-side equivalent fee

The worker is not paid through KingsHire in this mode. The amount and fee basis
must be recorded for each engagement so the platform can audit what was agreed.

## Minimum Charge Rule

The £10 minimum applies to the **amount processed per recurring period**, not to
the worker's pay rate as a universal employment minimum.

The supported cadence choices are weekly and monthly, so each platform charge
must be economically worthwhile. A daily cadence is excluded because its
repeated Stripe charges could make low-value roles unprofitable.

The minimum rule must be validated before a managed or direct recurring role is
activated. The exact user-facing handling for an amount below the minimum is:

- choose a larger cadence, or
- use Discuss pay at interview / direct settlement.

## Shared Settlement Engine

The settlement engine is domain-agnostic. It must not contain Placement or
Organisation-role UI concepts.

### Engine entities

`engagements` represents an accepted relationship between an Organisation and a
Kinglancer:

- `source_kind`: `placement | org_role`
- `source_id`: the domain record that created the engagement
- `organisation_id`
- `kinglancer_id`
- `settlement_mode`: `managed | direct`
- `cadence`: `weekly | monthly`
- `amount_per_period`: nullable until pay is agreed
- `duration_periods`: nullable for open-ended engagements
- lifecycle status: `pending_acceptance | pending_funding | active | ended | cancelled`
- signing, start, end and early-termination timestamps

`engagement_payments` is the per-period ledger:

- engagement and participant references
- `period_index` and `due_date`
- worker amount and both platform fee amounts
- status: `due | processing | held | released | failed | cancelled | disputed | refunded`
- Stripe PaymentIntent and transfer references
- charge, release, notice and dispute fields
- unique `(engagement_id, period_index)`

### Open-ended scheduling

- Bounded engagements generate their known periods.
- Open-ended engagements use a rolling schedule.
- The charge process creates the next period as the current period is
  processed.
- An open-ended role ends through the engagement termination flow, not because
  a fixed duration was exhausted.

### Current implementation checkpoint

Migration `060_settlement_engine.sql` and the pure core are implemented on the
`feat/settlement-engine` branch:

- `supabase/migrations/060_settlement_engine.sql`
- `lib/settlement/types.ts`
- `lib/settlement/schedule.ts`
- `lib/settlement/fees.ts`
- `tests/unit/settlement.test.ts`

The Phase 1 engine currently covers:

- weekly and monthly period arithmetic
- bounded and rolling period planning
- weekly/monthly release notice windows
- managed and direct fee calculations
- the £10 per-period minimum
- typed persistence for engagements and engagement payments
- idempotent schedule creation and rolling-period top-up
- off-session Organisation card charging
- managed escrow release through Stripe Connect
- protected charge and release cron routes

The full typecheck is currently blocked by unrelated parked Espees files in the
working tree. The settlement files themselves have no TypeScript errors, ESLint
passes, and the settlement unit suite passes.

The migration has been applied to the linked staging database and the generated
Supabase types include `engagements` and `engagement_payments`.

## Current Work Status

### Completed

- [x] Settlement schema: `engagements` and `engagement_payments`
- [x] Generated Supabase types for the settlement tables
- [x] Weekly/monthly cadence arithmetic
- [x] Bounded and rolling schedule planning
- [x] Managed and direct fee calculations
- [x] £10 per-period charge minimum
- [x] Typed settlement persistence layer
- [x] Managed off-session charging
- [x] Direct facilitation-fee charging
- [x] Managed Stripe Connect release handling
- [x] Weekly/monthly release notices
- [x] Protected charge and release cron routes
- [x] Settlement unit tests
- [x] Placement payment persistence delegates to the engagement ledger
- [x] Placement billing and payouts delegate to shared settlement functions
- [x] Placement contract tests updated for shared-ledger delegation
- [x] Organisation role schema for permanent/temporary, weekly/monthly pay and
   managed/direct settlement
- [x] Dedicated Organisation role posting surface
- [x] Role hiring creates a shared engagement
- [x] Kinglancer role-term acceptance surface
- [x] Organisation job list distinguishes recurring roles from one-off gigs
- [x] Owner and Kinglancer role workspaces show engagement/payment periods
- [x] Organisation-role mutual early-end (propose/confirm/decline/escalate)
- [x] Admin reconciliation for disputed role settlements (release/refund)

Checkpoint: commit `76a580d` on branch `feat/settlement-engine`.

### Remaining

- [ ] Managed funding UI for roles (org funds the first period, mirroring the
  Placement "fund first month" flow) — currently only Placements have this
- [ ] Run the full quality gate and validate on staging (in progress)
- [ ] Apply migration 061 to production at promotion time

The parked Espees work is intentionally outside this design and is not part of
the remaining Organisation Jobs scope.

## Placement Migration Strategy

There is no live Placement data to preserve. Therefore the settlement engine can
be generalized directly rather than protected by a long compatibility layer.

The Placement payment path now delegates to the shared engine and the old
Placement repository remains only as a domain compatibility projection. The
remaining Placement follow-up is to remove obsolete schema/code after staging
validation. Existing Placement product behaviour must remain intact:

- bounded duration
- managed/direct settlement modes
- recurring payment schedule
- escrow hold
- release and payout
- dispute handling

Placements remain their own product domain and UI. Only settlement mechanics are
shared.

## Implementation Sequence

1. **Engine foundation**
   - Complete typed database access for engagements and engagement payments.
   - Implement shared schedule creation and rolling-period top-up.
   - Implement managed off-session charge handling.
   - Implement direct facilitation-fee handling.
   - Implement shared payout/release handling.
   - Add weekly/monthly charge and release cron routes.

2. **Move Placements onto the engine**
   - Replace Placement-specific payment processing with engine calls.
   - Preserve Placement lifecycle and UI semantics.
   - Remove obsolete duplicated billing and payout code after parity tests.

3. **Build the Organisation role domain**
   - Add a distinct Organisation role posting flow.
   - Add permanent/temporary type.
   - Add weekly/monthly cadence.
   - Add money-only compensation.
   - Add Discuss pay at interview.
   - Keep one-off Organisation gigs available as a separate choice.

4. **Connect hiring to settlement**
   - Organisation accepts an applicant.
   - Create an engagement.
   - Kinglancer accepts the role terms.
   - Managed roles enter funding; direct roles record the agreed amount and
     activate without platform escrow.

5. **Build user and admin surfaces**
   - Organisation role list/detail/posting views.
   - Kinglancer role/application/agreement views.
   - Funding, payment history, release, dispute and termination views.
   - Admin reconciliation and exception queues.

6. **Quality and rollout**
   - Unit-test schedule and money invariants.
   - Test idempotency and concurrent cron runs.
   - Test managed and direct lifecycles.
   - Validate on staging before production migration.

## Non-Goals

- No daily recurring billing.
- No per-hour timesheets in this phase.
- No non-monetary compensation for Organisation roles.
- No Organisation roles hidden inside the Placement UI.
- No duplicate recurring payment engine.
- No changes to the existing one-off personal/Organisation gig flow unless a
  later product decision explicitly retires it.

## Open Design Questions

These must be resolved before the Organisation role UI is built:

- Exact temporary-role duration input and whether an end date or number of
  periods is shown to users.
- Whether a direct role's agreed amount is entered when the Organisation hires
  or during a separate agreement negotiation step.
- Whether direct facilitation fees are charged weekly/monthly automatically
  from the Organisation's saved card or handled through an invoice/admin
  workflow when pay is off-platform.
- The notice period before weekly and monthly managed payouts.
- Whether a role can change cadence or amount after activation, and how that
  affects already-created payment periods.
- Exact Organisation role permissions and visibility rules.
