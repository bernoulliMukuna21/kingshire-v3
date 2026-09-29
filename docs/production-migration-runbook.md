# Production migration runbook

Promoting the full `staging` line to production (`main`). At the time of writing,
`origin/main` is **164 commits behind** `origin/staging`: the organisation
feature, placements (Phase 1 & 2), the fee change, the single-source-of-truth /
type-coercion refactors, and terms re-consent all ship in this one promotion.

It's a Next.js **monolith** on Railway — one deploy, front and back together. The
**database is the only independent axis and the main risk**, because migrations
here are applied **by hand** in the Supabase SQL Editor with **no tracking
table**. So we verify prod's real state first, then apply the delta, then deploy.

**Golden rule:** DB migrations go to prod **before** the code deploy. Every
pending migration (032–056) is additive/backward-compatible (see §3), so the old
code keeps working against the new schema during the short window.

---

## 0. Pre-flight

- [ ] Confirm the prod Supabase project ref (`mdzousozzrnggtblusws`) via Railway
      prod web service `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Take a fresh prod DB backup / confirm PITR is on (Supabase → Database →
      Backups). This is the rollback for the DB half.
- [ ] Confirm `avatars` storage bucket exists on prod (older feature).

## 1. Verify what prod already has

Run [`supabase/prod_migration_check.sql`](../supabase/prod_migration_check.sql)
in the **prod** SQL Editor. It's read-only and returns one row per migration
032–056 with `present = true/false`.

**Result (2026-09-06):** prod is applied **through 034** (029–034 present,
`finalize_payment_attempt` present). **Everything 035 → 056 is missing.** The
`kind = re-run` rows (032, 037, 045, 046, 049, 052) always report `true` — they
can't be detected, so they're re-applied as part of the 035→056 batch (they all
sit inside that range) and are idempotent.

## 2. Apply the missing migrations (035 → 056)

One paste-ready, transaction-wrapped script is prepared:
[`supabase/prod_apply_035_to_056.sql`](../supabase/prod_apply_035_to_056.sql) —
it concatenates migrations 035 through 056 in order, wrapped in
`begin; … commit;` (all-or-nothing) and ends with `notify pgrst, 'reload
schema';`.

- [ ] Paste the whole file into the **prod** SQL Editor and run once.
- [ ] If the editor rejects `begin`/`commit`, delete those two lines and re-run.

Non-obvious things it handles (don't drop them if editing by hand):

- **041** creates the `placement-cvs` storage bucket **and** its RLS policies.
- **043** creates `placement_payments`; **046** grants on it — order preserved,
  so the service role won't hit `permission denied` (a real past bug).
- Create-table migrations without `if not exists` (**054, 056**) only run here
  because the verify query confirmed they're absent — do not re-run this script
  after a successful apply, or they'll error `42P07`.

Then **re-run** `prod_migration_check.sql` and confirm every detectable row is
`present = true`.

## 3. Backward-compatibility scan (result)

All of 032–056 are safe to apply ahead of the code deploy:

- New tables: placements + 5 related, `placement_payments`, `payout_accounts`,
  `user_subscriptions`, organisation tables (already on prod).
- New columns are all `NOT NULL DEFAULT …` or nullable → old inserts still pass.
- CHECK-constraint changes (037, 045, 047, 049) only **loosen** allowed values.
- Function migrations are `create or replace` → no signature break for callers.
- **No** `set not null` on existing columns, **no** `drop column`, **no**
  tightened constraints in this range. The only such landmine historically was
  029's `created_by NOT NULL` (already on prod, hot-fixed nullable — §5).

## 4. Live Stripe wiring (before/with deploy)

Do this in Stripe **live mode**, in the same account as prod's live keys. The app
**validates each price's amount + GBP + monthly interval** against the plan
before checkout, so the amounts below must match exactly.

- [ ] Live API keys on prod web service: `STRIPE_SECRET_KEY` (sk*live*…),
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk*live*…).
- [ ] Organisation subscription prices (recurring, monthly, GBP), then set the
      env vars on the prod web service:
  - Starter **£15/mo** → `STRIPE_ORGANISATION_STARTER_PRICE_ID`
  - Growth **£25/mo** → `STRIPE_ORGANISATION_GROWTH_PRICE_ID`
  - Scale **£40/mo** → `STRIPE_ORGANISATION_SCALE_PRICE_ID`
- [ ] User subscription prices (056, recurring monthly GBP):
  - Client **£5/mo** → `STRIPE_CLIENT_SUBSCRIPTION_PRICE_ID`
  - Kinglancer **£5/mo** → `STRIPE_KINGLANCER_SUBSCRIPTION_PRICE_ID`
  - (`scripts/create-subscription-prices.mjs` can create these two — run with
    the live `STRIPE_SECRET_KEY`.)
- [ ] Webhook endpoint `https://kingshire.uk/api/webhooks/stripe` subscribed to
      **all 7** events the route handles: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `payment_intent.canceled`, `account.updated`. Set `STRIPE_WEBHOOK_SECRET`
      from this live endpoint.
- [ ] Activate the Stripe Customer/Billing Portal in live mode (the app builds
      its own portal configuration via API for plan switching, but the portal
      must be turned on first).

## 5. Deploy the code

`main` is protected (requires PR). Promote `staging` → `main`:

1. Open a PR `staging` → `main` (draft first).
2. Merge with a **merge commit** (never rebase the shared branch).
3. Railway auto-deploys prod from `main`. Confirm `/api/health` returns `200`.

## 6. Post-deploy DB step (only after new code is live)

New code sets `jobs.created_by`, so close the 029 divergence:

```sql
update public.jobs set created_by = client_id where created_by is null;
alter table public.jobs alter column created_by set not null;
```

Do **not** do this before the deploy — old prod code doesn't set `created_by`
and would fail every job insert (the exact prior outage).

## 7. Cron services (Railway prod)

Ensure the prod environment has cron services for every worker. Placements added
**two new** crons that prod doesn't have yet:

- [ ] `npm run cron:auto-release`
- [ ] `npm run cron:cleanup-abandoned-checkouts`
- [ ] `npm run cron:charge-placements` ← new
- [ ] `npm run cron:release-placements` ← new

All cron services need the same env (incl. `CRON_SECRET`) as the web service.

## 8. Smoke test (prod)

Run the checklist in [`docs/deployment-checklist.md`](./deployment-checklist.md)
§7, plus the promoted features:

- [ ] Post a personal job → pay (Stripe test on staging first; live on prod) →
      transaction `held` → approve → `released` → transfer fires.
- [ ] Create an organisation via checkout → members/roles → org-owned paid job.
- [ ] Create a placement → admin review → kinglancer applies → org accepts →
      agreement active → managed monthly charge holds in escrow → release.
- [ ] Terms re-consent modal appears for an existing user.
- [ ] Confirm no `PGRST202` / `permission denied` in prod logs.

---

### Rollback

- **DB:** additive changes are safe to leave in place even if the deploy is
  rolled back (old code ignores new tables/columns). Restore from the §0 backup
  only if something was applied wrong.
- **Code:** revert the merge commit on `main`; Railway redeploys the prior build.
- Do **not** run §6 (`set not null`) until the new code is confirmed stable.
