# Admin overhaul implementation

Implements the admin audit's navigation, task aggregation and operational workflow consolidation. All changes use the existing Next.js app, Supabase schema and payment settlement services. No schema migrations, live payment operations or database corrections are part of this implementation.

## Delivered

- Six primary destinations: Overview, Action centre, Finance, People, Work, Reviews. Consistent Lucide icons, accessible active links, action badge, and a mobile menu with sign-out.
- Overview leads with the green money banner; financial detail is collapsed by default. A compact activity row and priority task preview replace the duplicate headline/cards and capped dispute snapshot.
- Request-scoped shared admin task snapshot. Complete paginated sources cover bank receipts, external payouts, ambiguous settlements, engagement holds, all three dispute types, placement publishing and experience verification. Counts and previews derive from the same deduplicated item list. Client approvals and unclaimed Stripe payouts are waiting items, not administrator approvals. Provider failures remain visible and suppress an apparently complete badge.
- A unified open-dispute workspace with source filters and existing domain actions. Original dispute routes remain reachable, with one-off history preserved explicitly. Payment recovery takes precedence over resolving or repaying the same payment.
- Finance tabs for summary, incoming funds, payouts, payment issues and paginated history. History covers one-off payments, recurring periods and the existing correction audit. Payment detail shows worker/context, allocation, funding/transfer/refund references and recorded audit events. Stripe receipt/transfer matching detects unallocated or mismatched funding, duplicated references, reversed transfers and inconsistent payout routes. Transfer amount variances are reported using actual Stripe outflows rather than subtracting fees again. Environment/Stripe-mode mismatches withhold estimates; test data is labelled.
- Reviews groups placement publishing and experience verification. Work provides real job/role/placement record browsing, search, status filtering and preserved pagination filters. People has name and role filters, with query failures reported explicitly.
- Admin service reads are gated by a shared request-scoped administrator/session check. Legacy entry points also enforce authorization before service reads. Admin review/payment queue helpers enforce authorization at their read boundaries and exhaust database pagination. Source-specific recurring dispute routes reject the wrong engagement kind.
- Manual receipt confirmation asks the administrator to verify actual receipt. Recording an external payout requires an outward reference rather than treating a prefilled job reference as payment evidence. Recurring dispute decisions have explicit confirmation dialogs. Existing server-side authorization, reservation, idempotency and compare-and-set settlement rules remain in place.

## Verification

- Unit coverage for access denial before service-client creation, task deduplication and priority, list/count equality, waiting versus action, legacy navigation, more than 200 disputes, partial provider failures, paid/reserved payout exclusion, source separation and receipt/transfer reconciliation.
- Production build, TypeScript, ESLint and full Vitest suite are required for final validation.
- Local browser checks render the actual shared components using illustrative fixtures. Verified six desktop/mobile destinations, expandable financial details, mobile sign-out, no horizontal overflow and no browser runtime errors. Verified unauthenticated requests redirect for six protected pages and return 401 for two payment mutation endpoints. No authenticated payout/refund operation was invoked.
- Browser screenshots: `output/previews/admin-overhaul-desktop.png` and `output/previews/admin-overhaul-mobile.png`. These use illustrative data, not staging or live balances. The temporary fixture route was removed after verification.

## Operational notes

The schema and legacy URLs are preserved. This does not introduce a forecasting model or a full accounting ledger; projected revenue still needs a defined period and earned-revenue policy. Bank receipt evidence remains manual. Receipt matching and complete task collection currently read the relevant history per request; React cache shares those reads only within the request. A larger platform may need a reconciled reporting snapshot and database-backed queue projection, rather than truncating results. No new global cache of user authorization or cross-user browser state is introduced.
