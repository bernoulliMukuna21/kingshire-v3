# Status / lifecycle consistency programme

Addendum to `TECHNICAL_AUDIT_2026-07-25.md` (see finding **M5 — domain logic
spread across routes and helpers**). This tracks a specific, incremental effort:
give every stateful entity a **single source of truth** for its lifecycle, so
the UI and the API can't drift and adding a new stage happens in one place.

## The pattern (north star)

For each lifecycle entity, one domain module (`lib/<entity>.ts`) owns:

1. the **status type** (one enum),
2. `derive<Entity>View(entity, ctx) → { pill, ...capabilities }` — the UI reads
   only this; no `status === x` branching in pages/components,
3. status → `{ label, className }` pill maps, colocated with the domain (not
   duplicated per page),
4. capability flags (e.g. `canComplete`) that **API route guards also derive
   from**, so what the UI offers equals what the server allows.

Reference implementations: `lib/placements.ts` (`derivePlacementView`) and
`lib/placement-agreements.ts` (`deriveAgreementView`).

## Done

| Entity              | Module                                                                                               | Notes                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Placement (listing) | `lib/placements.ts` → `derivePlacementView`                                                          | list + detail read from it; `PlacementActions` is a dumb renderer; unit-tested                                          |
| Placement agreement | `lib/placement-agreements.ts` → `deriveAgreementView`, `agreementStatusPill`, `placementPaymentPill` | agreement page + org participants list read from it; `/complete` guard derives from the same `canComplete`; unit-tested |
| Job application     | `lib/applications.ts` → `applicationStatusPill`                                                      | dashboard section + kinglancer jobs card read from it (removed 2 duplicated maps); unit-tested                          |
| Tab bars            | `lib/tabs.ts` → `resolveTab`, `countTabs`, `statusTabMatcher`                                        | applied to the placements list page; unit-tested                                                                        |

## Remaining (ranked by payoff / risk)

### 1. Jobs — biggest payoff, highest risk (do as its own PR)

The same `STATUS_CONFIG` (`open, in_progress, completed, approved, disputed,
cancelled`) is re-declared in ~6 files, `TAB_STATUSES` in 3, and there are 50+
inline `job.status === …` branches. Touches escrow/payment UI.

- `app/(dashboard-shell)/dashboard/client/jobs/[id]/page.tsx` (+ list)
- `app/(dashboard-shell)/dashboard/kinglancer/jobs/[id]/page.tsx` (+ list)
- `app/(dashboard-shell)/dashboard/organisations/[id]/jobs/page.tsx`
- `app/jobs/[id]/page.tsx`
- `lib/dashboard-action-rules.ts` (job-state booleans — fold into the view)
- Target: `lib/jobs.ts` → `deriveJobView(job, viewer) → { badge, actions[] }`;
  align the `app/api/jobs/**` guards (`if (job.status !== …)`) to the same
  capabilities. Do with a heavy test pass (escrow paths).

### 2. Job applications — small, safe

Near-identical `APP_STATUS` / `APP_STATUS_CONFIG` in 2 files.

- ✅ **Done** — `lib/applications.ts` → `applicationStatusPill`.

### 3. Tab filters — small, safe

`TAB_STATUSES` (tab → statuses) duplicated across jobs (×3) and placements (×1).

- ✅ Shared primitive `lib/tabs.ts` created + applied to the placements page.
- ⏳ The **jobs** tab bars are NOT yet migrated: the kinglancer jobs page has an
  "applied" tab that counts the applications table (not jobs-by-status), so it
  needs `deriveJobView`-aware handling rather than the generic matcher. Fold
  into the Jobs pass below.

### 4. Direct requests — medium (couple with the Jobs pass)

`direct_request_status` filtering is scattered across action-centre + the three
job list pages. It's a sub-state of jobs, so fold it into `deriveJobView`.

## Deliberately left alone (low ROI)

- **Transactions** (`client/transactions/page.tsx`) — one isolated map.
- **Disputes / verification / subscriptions** — near-binary status, minimal
  branching; centralising adds indirection without payoff.

## Rules going forward

- To add or change a stage/action for an entity that has a `derive<Entity>View`,
  edit that function **only**. Do not add `status ===` conditionals in pages.
- New status → label/color goes in the domain module, never inline in a page.
- If a route gates on status, derive the guard from the same view capability the
  UI uses.

> This is the maintainability slice of the larger audit (Stage 3). It is not a
> release blocker; sequence it around the audit's Stage 0–1 money/authz items.
