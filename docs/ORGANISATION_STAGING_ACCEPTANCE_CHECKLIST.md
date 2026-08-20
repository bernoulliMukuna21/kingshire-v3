# Organisation + Placements — Staging Acceptance Checklist

Work through this on `https://staging.kingshire.uk`. Each test has **Steps**,
**Expected**, and a **Result** line — mark Pass/Fail and add any comment.
Add findings inline; we'll turn Fails into fixes.

Legend: `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part 0 — Prerequisites (do once, before testing)

### P0.1 — Apply migrations to the STAGING Supabase DB

Apply, in order, whichever of these are not yet applied (Supabase → SQL Editor):
`029` → `030` → `031` → `032` → `033` → `034`.

- If a migration errors with `already exists`, it's already applied — skip to the next.
- After the last one: run `notify pgrst, 'reload schema';`.
- `Result: ☐ Pass ☐ Fail — Notes:`

### P0.2 — Verify SECURITY DEFINER grants (audit C1 / migration 032)

Run the inventory query from `docs/TECHNICAL_AUDIT_2026-07-25.md` (section C1).

- **Expected:** `get_client_stats`, `get_kinglancer_stats`, `increment_jobs_completed`,
  `recompute_profile_rating`, `reveal_expired_reviews` show **no** `anon` execute;
  the stats functions still allow `authenticated`; the rest are `service_role` only.
- `Result: ☐ Pass ☐ Fail — Notes:`

### P0.3 — Stripe test-mode config (staging keys' account)

- Create 3 recurring GBP monthly prices: **£10 / £25 / £40**, in the **same Stripe
  account** as the staging secret key.
- Set `STRIPE_ORGANISATION_STARTER_PRICE_ID`, `..._GROWTH_...`, `..._SCALE_...` on the
  staging web service.
- Test webhook subscribed to: `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`.
- Enable the test-mode Customer/Billing Portal.
- **(Known trap:** price IDs, secret key, publishable key and webhook secret must ALL
  be from the same Stripe account/sandbox — a mismatch causes "No such price".)
- `Result: ☐ Pass ☐ Fail — Notes:`

### P0.4 — Test accounts (confirmed emails)

- `owner@…` (Client), `member2@…` (Client), `kinglancer@…` (Kinglancer),
  `admin@…` (role=admin + admin passcode), `outsider@…` (Client).
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part A — Organisation foundation

### A1 — Create organisation via guided setup

Steps: as `owner`, go to `/organisation/start` → complete setup → choose **Starter** →
complete Stripe Checkout with test card `4242 4242 4242 4242`.

- **Expected:** workspace activates; `owner` is the **sole Owner**; one active subscription.
- `Result: ☐ Pass ☐ Fail — Notes:`

### A2 — Persistence & personal role intact

Steps: refresh the workspace; switch to personal dashboard and back.

- **Expected:** all org details persist; `owner`'s personal Client role unchanged.
- `Result: ☐ Pass ☐ Fail — Notes:`

### A3 — Invite a member

Steps: invite `member2` by email; accept via the invite link as `member2`.

- **Expected:** `member2` joins as **Member**; appears in the team list.
- `Result: ☐ Pass ☐ Fail — Notes:`

### A4 — Roles & permissions

Steps: promote `member2` to Admin; confirm Admin can manage jobs but not billing;
try an action a Member shouldn't do.

- **Expected:** permissions enforced per role (Owner/Admin/Member).
- `Result: ☐ Pass ☐ Fail — Notes:`

### A5 — Outsider is blocked

Steps: as `outsider`, open the org workspace URL directly.

- **Expected:** 404 / not authorised.
- `Result: ☐ Pass ☐ Fail — Notes:`

### A6 — Ownership transfer

Steps: as Owner, transfer ownership to `member2`.

- **Expected:** `member2` becomes Owner; old owner becomes Admin; exactly one Owner.
- `Result: ☐ Pass ☐ Fail — Notes:`

### A7 — Subscription card & billing portal

Steps: open the Subscription section as Owner; click the billing portal button.

- **Expected:** plan + status shown; Stripe portal opens.
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part B — Organisation jobs & payments (ORG‑J08 + C3 fixes)

### B1 — Member posts an org job

Steps: as an org member, post a paid Organisation job.

- **Expected:** job created, owned by the org, `created_by` = poster.
- `Result: ☐ Pass ☐ Fail — Notes:`

### B2 — Kinglancer applies

Steps: as `kinglancer`, apply to the org job.

- **Expected:** application visible to org members.
- `Result: ☐ Pass ☐ Fail — Notes:`

### B3 — Original poster pays (baseline)

Steps: the member who **posted** the job pays the applicant (test card).

- **Expected:** payment succeeds; escrow `held`; job `in_progress`.
- `Result: ☐ Pass ☐ Fail — Notes:`

### B4 — ⭐ Different member pays (ORG‑J08)

Steps: post a second org job as `owner`; have **`member2`** (not the poster) fund it.

- **Expected:** payment **succeeds** (this used to fail at finalization).
- `Result: ☐ Pass ☐ Fail — Notes:`

### B5 — Payment finalization is atomic/idempotent (C3)

Steps: complete a payment normally; if you can, trigger the webhook twice (or retry).

- **Expected:** exactly **one** transaction per job; no partial state; no double‑charge.
- `Result: ☐ Pass ☐ Fail — Notes:`

### B6 — Approve work → single release

Steps: mark work complete; approve as an authorised member; retry approve.

- **Expected:** one transfer/release; retry is a no‑op (no double payout).
- `Result: ☐ Pass ☐ Fail — Notes:`

### B7 — Removed/outsider cannot pay or approve

Steps: remove a member, then have them try to pay/approve; try as `outsider`.

- **Expected:** denied (403).
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part C — Placements: opt-in, create, admin review

### C1 — Kinglancer opt-in

Steps: as `kinglancer`, `/dashboard/profile` → toggle **Open to placements** on → Save.

- **Expected:** toggle persists after refresh.
- `Result: ☐ Pass ☐ Fail — Notes:`

### C2 — Create a placement (draft)

Steps: org member → workspace → **Manage placements** → **Create placement**; fill
contribute/receive, hours, duration, an **ordinary** category (e.g. Admin & Office).

- **Expected:** saved as **Draft**.
- `Result: ☐ Pass ☐ Fail — Notes:`

### C3 — First placement → manual review

Steps: publish the draft from the placements list.

- **Expected:** status becomes **In review** (first placement is always reviewed).
- `Result: ☐ Pass ☐ Fail — Notes:`

### C4 — Manual-labour category → manual review

Steps: create + publish a placement using **Cleaning & Maintenance** or
**Construction & Trade**.

- **Expected:** status **In review** (risk category), even if not the first.
- `Result: ☐ Pass ☐ Fail — Notes:`

### C5 — Admin review queue

Steps: as `admin`, open `/admin/placements`; **Approve** one, **Reject** another.

- **Expected:** approved → **Open**; rejected → **Cancelled**.
- `Result: ☐ Pass ☐ Fail — Notes:`

### C6 — Kinglancer discovery

Steps: as `kinglancer`, open **Placements** in the nav (`/dashboard/kinglancer/placements`).

- **Expected:** approved (Open) placements are listed with contribute/receive.
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part D — Placements: apply → agreement → Passport

### D1 — Apply

Steps: as `kinglancer`, apply to an open placement with a short message.

- **Expected:** shows **Applied**; org sees the applicant on the placement detail page.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D2 — Org accepts → agreement created (seat reserved)

Steps: org opens the placement → **Reject** one applicant, **Accept** another.

- **Expected:** an agreement is created (org‑signed, **pending acceptance**); a
  participant seat is reserved.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D3 — Participant seat limit

Steps: on **Starter** (3 participants), accept applicants until 3 are reserved/active,
then try to accept a 4th.

- **Expected:** 4th accept is **blocked** with a plan‑limit message.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D4 — Kinglancer signs the agreement

Steps: as `kinglancer`, open Placements → **Awaiting your acceptance** → **Accept**
(try **Decline** on a spare one).

- **Expected:** Accept → agreement **Active**; Decline → **Cancelled** (seat freed).
- `Result: ☐ Pass ☐ Fail — Notes:`

### D5 — Milestones

Steps: open the agreement page (`/dashboard/placements/agreements/…`) as the org →
add a milestone → **Confirm** it.

- **Expected:** milestone added; confirm marks it **Confirmed**; kinglancer can view.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D6 — Check-ins

Steps: post a check‑in as the org **and** as the kinglancer.

- **Expected:** both appear, newest first.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D7 — Complete → experience record

Steps: as the org, **Complete placement** with a title, skills, outcome, and
"show on public profile" ticked.

- **Expected:** agreement **Completed**; seat freed; record created.
- `Result: ☐ Pass ☐ Fail — Notes:`

### D8 — Placement Passport on public profile

Steps: open the kinglancer's public profile `/kinglancers/<id>`.

- **Expected:** a **Placement Passport** section shows the completed record
  (title, org, skills, outcome).
- `Result: ☐ Pass ☐ Fail — Notes:`

### D9 — Open-listing limit

Steps: publish placements until the plan's listing cap (Starter = 2 open), then try
to publish another.

- **Expected:** blocked with a plan‑limit message until one is closed.
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Part E — Guards, negatives & copy

### E1 — Placement validation

Steps: try to create with a 2‑char title / 20 weekly hours / 30 weeks / no category.

- **Expected:** each rejected with a clear message.
- `Result: ☐ Pass ☐ Fail — Notes:`

### E2 — Non-member cannot manage placements

Steps: as `outsider`, hit an org placement URL / API.

- **Expected:** 403 / 404.
- `Result: ☐ Pass ☐ Fail — Notes:`

### E3 — Non-kinglancer cannot apply

Steps: as a Client account, try to apply to a placement.

- **Expected:** blocked ("switch to Kinglancer").
- `Result: ☐ Pass ☐ Fail — Notes:`

### E4 — Inactive subscription blocks new work

Steps: (if feasible) cancel/lapse the subscription, then try to create a job/placement.

- **Expected:** blocked (402, "reactivate subscription").
- `Result: ☐ Pass ☐ Fail — Notes:`

### E5 — Plan cards show placements as active

Steps: open `/organisation` and the setup wizard plan step.

- **Expected:** placement lines are **active** (green ticks), **no "Soon"** badges.
- `Result: ☐ Pass ☐ Fail — Notes:`

---

## Sign-off

- All Part 0 prerequisites done: ☐
- No Severity 1/2 defects open: ☐
- Ready to promote `staging` → `main`: ☐
