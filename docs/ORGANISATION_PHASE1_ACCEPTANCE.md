# Organisation Phase 1 acceptance

This checklist is the release gate for the Organisation foundation. Apply
`supabase/migrations/029_organisation_foundation.sql` to a non-production
Supabase project before running it.

The traceable scenario catalogue is in
`docs/ORGANISATION_PHASE1_TEST_SCENARIOS.md`. Use the scenario IDs from that
document when recording results or defects. This checklist provides the
recommended execution journey rather than replacing the detailed matrix.

For a browser-only walkthrough against `https://staging.kingshire.uk`, use
`docs/ORGANISATION_STAGING_TEST_RUN.md`.

## Test accounts

Create four confirmed accounts:

- `owner@example.test` — client
- `admin@example.test` — client
- `member@example.test` — kinglancer or client
- `outsider@example.test` — client

The personal role is deliberately mixed: Organisation membership must not
change a user's personal Client/Kinglancer role.

## Automated checks

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run test:e2e
```

The unauthenticated Playwright suite checks workspace redirects and invalid
invitation handling. The following authenticated scenarios require a connected
Supabase test project and test users, so they remain an explicit release
checklist rather than using production credentials in source control.

## Creation and workspace switching

1. Sign in as `owner@example.test`.
2. Create "KingsHire Test Organisation".
3. Confirm the creator is assigned `Owner`.
4. Complete every profile field, refresh, and confirm the values persist.
5. Switch to the personal dashboard and back to the Organisation workspace.
6. Confirm creating the Organisation did not alter the owner's personal role.

Expected: one Organisation, exactly one owner, and both workspaces remain
available.

## Invitations and permissions

1. As Owner, invite Admin and Member with their respective roles.
2. Open each invitation while signed out. Sign in with the matching email and
   accept it.
3. Try accepting an invitation while signed in with `outsider@example.test`.
4. Try accepting the same invitation twice.
5. Confirm Admin can edit the profile, invite/remove Members, and manage jobs.
6. Confirm Admin cannot appoint another Admin, transfer ownership, delete the
   Organisation, or perform owner-only billing actions.
7. Confirm Member can manage jobs and applicants but cannot edit the
   Organisation or manage members.
8. Confirm Owner can change Member between Member and Admin.
9. Confirm neither Owner nor Admin can remove the current Owner.
10. Remove Member and confirm their workspace access immediately disappears.

Expected: wrong-email, duplicate, expired, removed-member, and unauthorised
actions are rejected without changing data.

## Ownership and deletion

1. As Owner, transfer ownership to Admin.
2. Confirm the former Owner becomes Admin and the new Owner has owner-only
   controls.
3. Confirm the former Owner can no longer transfer or delete.
4. With an active job present, attempt deletion.
5. Close/remove the active job and delete the Organisation.

Expected: there is always exactly one Owner; deletion is blocked while jobs are
active; a deleted Organisation disappears from every member's switcher.

## Paid-job lifecycle

1. As Member, post an ordinary public paid job from the Organisation.
2. Confirm it appears in the Organisation job list, not as a second personal
   workspace.
3. As a Kinglancer outside the Organisation, apply.
4. As Admin, view applicants, choose the applicant, and complete payment with a
   Stripe test card.
5. As Kinglancer, mark work complete.
6. As Owner, approve the work and release payment.
7. Confirm the Organisation transaction list shows the held/released
   transaction.
8. Repeat with a direct/private job and confirm another authorised
   Organisation member can view and manage it.
9. Remove the member who originally posted a job and confirm Owner/Admin can
   still manage the Organisation-owned job.

Expected: existing paid-job fees and Stripe flow are unchanged; Organisation
ownership survives poster removal; only authorised members can manage records.

## Data checks

Run these in the Supabase SQL editor after the scenarios:

```sql
select organisation_id, count(*)
from organisation_members
where role = 'owner'
group by organisation_id
having count(*) <> 1;

select j.id
from jobs j
left join organisations o on o.id = j.organisation_id
where j.organisation_id is not null and o.id is null;

select i.id
from organisation_invitations i
join organisation_members m
  on m.organisation_id = i.organisation_id
join profiles p
  on p.id = m.user_id
 and lower(p.email) = lower(i.email)
where i.accepted_at is null;
```

The first two queries must return no rows. The final query is a diagnostic for
pending invitations whose email already belongs to a member; it should also
return no rows.
