# Admin product and implementation audit — 15 October 2026

## Scope

Reviewed all ten protected admin pages, the shared shell and login/session guard, admin mutation endpoints, payment/review query helpers, the current financial derivation, and the existing personal/organisation action-centre model. This is a source review and redesign recommendation, not a penetration test, live queue census, or a newly completed financial reconciliation. No admin actions, payment mutations or deployments were performed for this audit. The approved overview image is a standalone design preview, not implemented routing.

## Recommendation

Build an admin action centre and reorganise navigation around the operator's task. Preserve the payment/review domain services and settlement safeguards. The sidebar currently exposes database/domain distinctions as separate destinations and mixes record browsers, review queues and exception handling at the same level.

Use six primary destinations:

| Destination | Purpose | Existing coverage / migration |
| --- | --- | --- |
| Overview | Green available-money banner, compact activity, highest-priority tasks | `/admin`; remove duplicate large heading, processed-volume card and always-open finance breakdown |
| Action centre | All outstanding admin tasks and waiting items; filters for payments, disputes and reviews | New aggregate view; deep-link to each domain workflow |
| Finance | Cash, revenue, expenses and payment history; tabs for incoming funds, payouts and payment issues | Manual-payments and settlement-recovery pages become finance subsections |
| People | User directory and account context | Users page; organisation directory is a future gap, not an existing implemented capability |
| Work | Job/role/placement records and operational context | Existing Jobs page; current Placements page is only pending review, so a true placement record browser needs implementation |
| Reviews | Placement publishing and experience verification, with pending/completed states | Existing placement and verification queues, accurately labelled |

Disputes get one unified workspace reached from the action centre's Disputes filter. Within it, use All / Jobs / Role payments / Placement payments filters and shared case presentation. It can also be linked contextually from Finance and Work. Do not add three dispute sidebar entries again. Retain existing routes or add redirects when canonical routes are ready, so bookmarks and notifications continue working.

Use consistent Lucide icons instead of the current emoji set. On mobile, use a labelled menu or drawer with these six destinations rather than ten horizontally scrolling pills. Show only the total actionable count beside Action centre; other queue counts appear within their owning views.

## Confirmed findings

### P1 — Admin reporting misses tasks and misstates the dispute count

`app/admin/(protected)/page.tsx` selects only open one-off `disputes`, limits that result to five, and uses the returned list length for the headline count. Six open job disputes would display five; role and placement payment disputes are absent entirely. The count and "All clear" claim therefore do not cover platform-wide disputes.

The homepage does not aggregate pending bank receipts, manual payouts, placement reviews, experience verification, or settlement-recovery tasks. Operators must inspect separate destinations to discover their work. Replace the capped headline with a projection of the complete shared action list; retain a separately labelled bounded preview.

### P1 — Authorization is inconsistent at service-client read boundaries

The protected layout calls `requireAdminPage`, and Overview, Users and Settlements also call it themselves. Jobs, Disputes, Manual payments, Placements, Verifications and both recurring dispute pages do not check locally before service-client reads, and their queue helpers generally do not perform administrator authorization internally.

This is reliance on layout authorization, not evidence of a demonstrated exploit. The installed Next.js authentication guide warns that layouts may not rerender on navigation and recommends authorization in the data access layer. Add an authenticated admin data facade that validates both the current admin role and signed admin session before service reads. Every entry point should call it, including future action-centre providers. Do not assume the service client enforces RLS.

Reviewed admin mutation routes do check current user, admin role and admin session. Preserve these checks and the settlement reservation/idempotency/CAS mechanisms. Move repeated guards into a shared server helper without weakening them.

### P1 — Some unpaginated queues can silently truncate

`getPendingManualAttempts`, `getManualPayoutQueue`, `getDisputedEngagementPayments`, `listPlacementsForReview` and `listExperienceRecordsForReview` query without exhausting pages or exposing pagination. Supabase's response cap can therefore omit tasks. Overview's job activity list is also unpaginated. Existing Users/Jobs/one-off Disputes browsers have pagination; settlement-recovery and finance ledger reads already use `collectPages`.

A unified task list must read all qualifying items or use a database-backed paginated projection with a consistent total. Do not build badge counts from independently filtered or truncated queries. Use stable IDs and deterministic ordering.

### P1 — Finance is aggregate accounting, not continuous reconciliation

`getAdminStripeActivity` sums full Stripe history. `deriveAdminFinancials` combines that history with the current database ledger. There is no persistent automated match between each Stripe receipt/transfer and its corresponding database payment, environment/account identity, or manual payout evidence. Unknown Stripe movement types withhold estimates, but an otherwise recognised charge missing from the ledger is not individually detected.

The staging screenshot's cash, held funds and lifetime earnings must not be assumed to reconcile merely because all are valid numbers. Verify Stripe mode/account against environment and reconcile individual receipts/transfers before presenting figures as verified. Show test mode clearly on staging. Keep cash, gross revenue and earnings distinct; do not turn deposit/top-up principal into revenue or subtract already-booked fees from current cash again.

A durable finance view needs reconciled payment history, source evidence and visible correction/audit history. The current recovery audit exists but is not a general finance audit browser. No additional money movement should be inferred from a navigation overhaul.

### P2 — Duplicate navigation reflects source types, not identical records

There are three dispute pages. Role and placement payment queues both read `engagement_payments` but deliberately filter by `engagement.source_kind` through their respective helpers. They are not the same items duplicated twice. One presentation can aggregate them while preserving source type, context and domain-specific decisions.

The role-payments endpoint checks for a disputed engagement payment but does not itself restrict `source_kind` to an organisation role. This is an admin-authorized operation, not a proven privilege escalation, but source-specific route names imply a constraint they do not enforce. A unified resolver should validate the canonical payment's context and allowed actions explicitly.

### P2 — "Manual payments" conflates incoming funding and outgoing payment

The page describes bank-transfer settlements, while `getManualPayoutQueue` includes held transactions on approved jobs, including card-funded manual payouts. Label funding rail and payout rail separately. Proposed tabs: Incoming funds / Payouts / Payment issues / History.

The manual queue currently infers eligibility broadly from held status plus approved job status; it does not filter out every transfer/reference/reservation/reconciliation state in its select. Settlement RPCs can reject ineligible actions, but the screen should explain the actual state before presenting a payment action. Extend one shared eligibility/view function, not parallel conditions in task, finance and overview screens.

`RecordPayoutButton` prepopulates the job/inbound reference and calls its action "Mark paid". A prefilled reference alone is weak evidence that a distinct outward bank payment occurred. Use "Record external payout", show recipient/net amount/rail, and request the actual outward transaction reference. "Confirm funds received" should explicitly mean the admin has checked the bank receipt, distinct from the client saying it was sent. Keep source evidence and actor/time in audit history.

### P2 — Review destinations are ambiguous

`/admin/placements` lists only `pending_review` placement listings, not all placements. `/admin/verifications` lists experience records with `verification_status = pending`, not general identity verification. Group these in Reviews with "Placement publishing" and "Experience verification" tabs. Implement a separate Work placement browser if all records need browsing; renaming the queue alone does not create one.

### P2 — Record browsers have limited investigation context

Users, Jobs and one-off Disputes pages are paginated but have no implemented search/status filters in the reviewed pages. Jobs and job disputes link to public job pages rather than a dedicated admin case detail page. Recovery identifies records largely by IDs. Provide named participant/job/organisation context and a consistent detail view with timeline, funding/payout state and audit evidence before exposing exceptional payment operations.

### P2 — Some reads hide failure as empty state

Overview jobs/disputes and Users/Jobs/Disputes pages use `data ?? []` without surfacing their query error. An outage can look like zero jobs/users/disputes or "All clear". Queue helpers for reviews and payments generally throw on their primary errors; enrichment queries sometimes ignore errors. Model provider results as ready / unavailable, preserving other provider results and explicitly showing when a queue cannot be verified.

## Admin action-centre contract

Reuse the existing item presentation, stable IDs, deduplication and count-from-items conventions where appropriate. Do not pass admin access through personal client/Kinglancer providers, and do not simply add admin to the personal role union. Introduce admin-scoped providers behind the shared admin data boundary.

Proposed provider coverage:

| Provider | Administrator action | Waiting / context |
| --- | --- | --- |
| Bank receipts | Verify receipt of money against evidence | Client has not yet marked money sent; client says sent is evidence of a claim only |
| Worker payouts | Eligible approved unpaid work needing external payout or a supported Stripe action | Onboarding or another party's prerequisite pending |
| Payment issues | Reconcile ambiguous outcomes; allow only domain-permitted retry/reset | Saved uncertain attempts and engagement settlement holds |
| Disputes | Review/resolve one-off, role and placement cases | Awaiting evidence or response when recorded |
| Placement publishing | Approve/reject pending listings | No admin action after decision |
| Experience verification | Approve/reject pending experience | No admin action after decision |

A normally completed job awaiting client approval is a **waiting** item for admin oversight, not automatically a task for admin approval. The earlier visual mockup's "Review job" suggestion needs this correction. Only show an administrator action when a defined escalation/override permission and policy actually permit it.

Each item should carry canonical source identity, item kind (action/waiting), title, party/work context, monetary context where relevant, created/age information, canonical destination and a single derived allowed-action state. Dedupe the same payment across recovery/dispute/manual queues when it represents one immediate decision; link its secondary contexts. Define priority explicitly (uncertain money outcomes and disputes before routine review), and do not invent SLA/overdue labels without a policy.

The overview, sidebar badge and action-centre list must use the same complete snapshot. `actionCount` counts actionable items only; waiting items are visible under their own filter and excluded from the action badge. Keep completed/history records out of active tasks. Counts must update from refreshed database reads after successful mutations, with no browser cross-user state store.

## Delivery sequence

1. **Correctness foundation:** shared admin read authorization; complete queue providers; source/eligibility views; explicit unavailable states; tests for permission checks, deduplication, count/list equality, source types and settlement states.
2. **Navigation and overview:** implement the approved green-banner layout and six-item sidebar; remove duplicate headings/finance volume cards; finance breakdown collapsed by default; use the real admin task projection for needs-attention previews. Preserve existing routes during migration.
3. **Workflow consolidation:** action centre; unified disputes workspace; Finance subsections; Reviews tabs; contextual case detail with audit trail. Keep settlement and notification behavior in existing domain services.
4. **Reporting/projections:** only after finance reconciliation, define period-based earned revenue, Stripe costs, net earnings, payouts and available cash. Project earned revenue from operating activity, not current cash including top-ups.

## Acceptance criteria

- One sidebar destination per top-level task area, with matching desktop/mobile structure and correct active navigation.
- One action model/list feeds task page, preview and badge; more than five disputes and more than one response page are accurately represented.
- No queues lost under source grouping or old-route redirects; role and placement disputes retain their context and supported actions.
- Unauthorized direct reads/actions fail; session expiry is enforced at service read and mutation boundaries.
- Failed providers show unavailable, never zero/all clear; incomplete finance reconciliation is visible.
- Completed manual payouts and Stripe transfers never reappear as unpaid; in-flight outcomes cannot be paid a second time; client approvals do not become admin actions by accident.
- Overview leads with available cash, hides finance detail by default, and clearly separates cash from revenue and earnings.
- No schema migration unless needed for a defined workflow; additive migrations staged first, generated types regenerated using the project command.
- TypeScript, ESLint and Vitest quality gate passes for implementation; verify desktop/mobile layouts and key user journeys before pushing an overhaul.

## Key implementation references

- Navigation: `components/admin/AdminShell.tsx`.
- Admin guard: `lib/admin-dashboard.ts`, `lib/admin-auth.ts`, protected layout.
- Installed framework guidance: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, "Layouts and auth checks" and "Creating a Data Access Layer" sections.
- Existing action-centre conventions: `lib/action-centre/index.ts`, `types.ts`, `view.ts`.
- Payment task sources: `lib/db/payment-attempts.ts`, `transactions.ts`, `engagement-payments.ts`.
- Review sources: `lib/db/placements.ts`.
- Source adapters: `lib/db/role-payments.ts`, `placement-payments.ts`.
- Settlement states: `lib/settlement/recovery-view.ts`, `job-transfers.ts`, `dispatch.ts` and settlement RPCs.
- Finance: `lib/admin-financials.ts`, `lib/admin-stripe-financials.ts`.
