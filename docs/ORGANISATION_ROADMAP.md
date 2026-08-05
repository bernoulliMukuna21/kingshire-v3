# Organisation — delivery roadmap

**Living document.** Tracks how the Organisation feature is phased and what is
being tackled next. Update it as phases move. Detailed acceptance/testing lives
in `ORGANISATION_PHASE1_ACCEPTANCE.md`, `ORGANISATION_PHASE1_TEST_SCENARIOS.md`,
and `ORGANISATION_STAGING_TEST_RUN.md`. Architecture and product decisions are
in `HANDOVER.md` sections 15–17.

## Phase map

```
Phase 1  Foundation (finish + ship)      ← current focus
Phase 2  Placement Passport MVP
Phase 3  Verification & badges
Phase 4  Talent Pipeline
```

Placements, verification, and the talent pipeline are **not built**. They were
deliberately deferred out of Phase 1.

---

## Phase 1 — Foundation (finish & ship)

Built already: organisation entity, memberships, invitations, workspace
switching, profile edit/soft-delete, Owner/Admin/Member permissions, ownership
transfer, subscription onboarding (Starter £10 / Growth £25 / Scale £40 via
Stripe Checkout), and organisation-owned **paid jobs**.

Remaining work before production:

### 1. Fix cross-member payment — ORG-J08 / STG-29 (release blocker) — DONE
- **Symptom:** only the original poster can pay for an organisation job; any
  other authorised member is rejected at payment finalization.
- **Root cause:** `finalizePaymentAttempt` (`lib/db/payment-attempts.ts`)
  enforces `job.client_id !== attempt.client_id` and never loads the job's
  `organisation_id`. `createPaymentAttempt` is correctly gated by
  `canManageJob`, and stores the payer in `attempt.client_id`.
- **Fix:** load `organisation_id` in the finalize job select; for
  organisation-owned jobs authorise by **current membership + `manage_jobs`
  permission** instead of poster-equality. Personal jobs keep the exact
  `client_id` match. Re-check membership at finalize (a member may have been
  removed between attempt and webhook — ORG-R04).
- **Tests:** ORG-J08 (colleague pays), ORG-J09/J10 (single release, no double
  transfer), plus a regression that a non-member/removed member is rejected.

### 2. Technical Audit Stage 0 confirmed defects — DONE
From `TECHNICAL_AUDIT_2026-07-25.md`, verify/resolve before release:
- C1 — SECURITY DEFINER function grants (revoke public/anon/authenticated).
  Migration 032; also run the C1 inventory query against staging + prod.
- C4 — auto-release cron DB client correctness.
- H9 — escape untrusted HTML in emails.

### 2b. C3 — atomic payment finalization — DONE
- `finalizePaymentAttempt` spanned several independent PostgREST calls, so a
  crash/race could leave a funded Stripe payment with partially-advanced state.
- Moved the whole transition into one locked Postgres function
  (`finalize_payment_attempt`, migration 033): lock attempt + job, validate
  states, authorise the payer (incl. ORG-J08 membership), reserve/select the
  worker, reject competing applications, insert the unique escrow transaction,
  mark the attempt succeeded — commit once. The TS wrapper maps the result and
  keeps idempotent races as success so Stripe stops retrying. The now-dead
  `selectApplicant` helper was removed.
- C5 (org creation/invitation atomicity) is already handled in migration 029.
  A durable outbox for post-commit side-effects remains a later (H-level) item.

### 3. Acceptance on staging
- Apply migrations 029–033 to the staging Supabase project.
- Run `ORGANISATION_PHASE1_ACCEPTANCE.md`; ORG-J08 and payment-consistency
  scenarios must pass; no Severity 1/2 defect open.

### 4. Ship to production
- Merge `staging` → `main` (also carries the webhook idempotency fix).
- Apply migrations 029–033 to the production Supabase project.
- Create **live** Stripe prices (£10/£25/£40 monthly GBP) in the prod account;
  set `STRIPE_ORGANISATION_{STARTER,GROWTH,SCALE}_PRICE_ID`; live webhook
  (incl. `checkout.session.completed`, `customer.subscription.updated/deleted`);
  enable the live Billing/Customer Portal.

---

## Phase 2 — Placement Passport MVP

The first non-job organisation capability and the core subscription value.

- Data model: `placements`, `placement_applications`, `placement_agreements`,
  `placement_milestones`, `placement_check_ins`, `experience_records`.
- "Open to placements" opt-in on kinglancer profiles (separate from job
  alerts).
- Placement listings that separately show **What you will contribute** and
  **What you will receive**; promised value declared before application.
- Agreement generation and acceptance on both sides (auditable signer +
  version); milestone + check-in tracking; completion → verified experience
  record on the public profile.
- Safety scaffolding: 18+, default 4–12 week duration (6-month max), manual
  review for manual-labour categories, exception-based admin review.

## Phase 3 — Verification & badges

- Register checks (Companies House / Charity Commission) where possible.
- Admin certification workflow; revocable "verified organisation" badge.
- Registration number is evidence only; absence does not imply illegitimacy.

## Phase 4 — Talent Pipeline

- Shortlist opted-in candidates; private talent pool; invite participants to
  paid work. No recruitment success/conversion fee.

---

## Deferred / parked

- International-student, right-to-work, payroll, and international compliance
  workstream (explicitly parked — not resolved).
- Admin dashboard improvements (Users role filters, Jobs status filters) —
  parked, unrelated to the organisation critical path.
