# Organisation Phase 1 staging test run

Target: `https://staging.kingshire.uk`

This is a browser-led test run for a human tester. It is different from the
unit and database scenario catalogue. Record the application commit and confirm
migration 029 was successfully applied to the staging Supabase project before
starting.

## Before testing

The Organisation navigation must be visible after sign-in. If it is not,
confirm that:

1. the Organisation application changes are deployed to staging;
2. migration `029_organisation_foundation.sql` is applied to staging;
3. the staging deployment has its Supabase URL, publishable key, and secret
   key;
4. the deployment health check is passing.

Do not run these scenarios against production.

## Test accounts

Use six confirmed staging accounts. Do not share passwords in this document.

| Label | Personal role | Purpose |
|---|---|---|
| OWNER | Client | Creates and owns the Organisation |
| ADMIN | Client | Tests delegated administration |
| MEMBER | Client | Tests ordinary Organisation job management |
| KING-MEMBER | Kinglancer | Proves Organisation membership does not alter personal role |
| APPLICANT | Kinglancer | Applies to Organisation jobs |
| OUTSIDER | Client | Tests unauthorized access |

Use a unique run suffix, for example `20260725-01`. Name the Organisation:

`Staging Test Organisation 20260725-01`

Use the same suffix in job titles. This makes test data identifiable and avoids
collisions with earlier runs.

## Evidence sheet

For every scenario record:

| ID | Result | Notes/evidence |
|---|---|---|
| Example: STG-01 | Pass/Fail/Blocked | Screenshot, URL, visible error, Stripe ID, or defect link |

If a test fails, record the exact actor, page URL, action, expected result,
actual result, and approximate time. Do not keep repeating payment actions
after an unexpected result.

## Run 1 — Creation and personal workspace

### STG-01: Create an Organisation

1. Sign in as OWNER.
2. Open **Organisations** from the dashboard navigation.
3. Select **Create Organisation**.
4. Enter:
   - Name: the unique test Organisation name;
   - Type: Company;
   - Organisation email: an email controlled by the tester;
   - Website: a valid `https://` URL;
   - Location: London;
   - Country: United Kingdom;
   - Registration number: `STAGING-TEST`;
   - Description: `Organisation Phase 1 staging test`.
5. Submit.

Expected:

- the Organisation workspace opens;
- the workspace identifies OWNER as `owner`;
- job count is 0;
- member count is 1;
- released spend is £0.00;
- no duplicate Organisation appears after refreshing.

### STG-02: Profile persistence

1. Edit the Organisation description and location.
2. Save and refresh the browser.
3. Leave the Organisation workspace and return.

Expected: updated values remain after refresh and navigation.

### STG-03: Workspace switching

1. Use **Switch workspace** to open OWNER's personal Client dashboard.
2. Return to the Organisation workspace.

Expected:

- both workspaces remain available;
- OWNER remains a Client personally;
- Organisation creation has not changed the personal profile or role.

### STG-04: Invalid profile input

Try an invalid email and a website using a non-HTTP protocol.

Expected: the form/API rejects the values and previously saved data remains
unchanged.

## Run 2 — Invitations

### STG-05: Owner invites Admin

1. As OWNER, invite ADMIN with role `Admin`.
2. Copy the generated invitation link.
3. Open the link in a private browser window.
4. Sign in as ADMIN and accept.

Expected:

- ADMIN enters the same Organisation;
- ADMIN is displayed as `admin`;
- accepting does not create another personal account or change ADMIN's Client
  role.

### STG-06: Owner invites Member

Repeat STG-05 for MEMBER with role `Member`.

Expected: MEMBER joins with role `member`.

### STG-07: Invite a Kinglancer

Invite KING-MEMBER as Member and accept while signed in as KING-MEMBER.

Expected:

- KING-MEMBER can enter the Organisation workspace;
- their personal workspace remains a Kinglancer dashboard;
- they have Member permissions inside the Organisation.

### STG-08: Wrong account attempts acceptance

1. Create an invitation for a controlled unused email or another test account.
2. Open its link while signed in as OUTSIDER.
3. Attempt acceptance.

Expected:

- acceptance is forbidden with an understandable message;
- OUTSIDER does not gain workspace access;
- the intended recipient can still accept afterward.

### STG-09: Duplicate acceptance

Open a previously accepted invitation link and attempt to accept it again.

Expected: it is shown as invalid, expired, or already accepted; membership is
not duplicated.

### STG-10: Duplicate invitation

As OWNER, invite the same pending email again before it is accepted.

Expected: the second request reports that a pending invitation already exists.

### STG-11: Existing member invitation

Try inviting ADMIN again after ADMIN has joined.

Expected: the request reports that the person is already a member.

### STG-12: Unknown invitation

Open:

`/organisation-invitations/00000000-0000-0000-0000-000000000000`

Expected: a safe invalid/expired message with no Organisation information.

## Run 3 — Role permissions

Open separate private browser profiles for OWNER, ADMIN, MEMBER, and OUTSIDER
where possible. This reduces accidental testing as the wrong actor.

### STG-13: Admin capabilities

As ADMIN:

1. Edit the Organisation profile.
2. Invite a controlled account as Member.
3. Remove that Member.
4. Post an ordinary Organisation job.

Expected: all four actions are allowed.

### STG-14: Admin restrictions

As ADMIN, attempt to:

1. invite another Admin;
2. change an existing Admin;
3. transfer ownership;
4. delete the Organisation.

Expected: each action is absent from the interface or rejected by the API.

### STG-15: Member capabilities

As MEMBER:

1. open the Organisation;
2. post an ordinary Organisation job;
3. open and edit an open Organisation job.

Expected: job management is allowed.

### STG-16: Member restrictions

As MEMBER, attempt to edit the Organisation profile, invite someone, change a
role, remove someone, transfer ownership, or delete the Organisation.

Expected: controls are absent or requests are forbidden.

### STG-17: Outsider guessed URL

1. Copy the Organisation dashboard URL.
2. Open it while signed in as OUTSIDER.

Expected: OUTSIDER receives not-found/denied behavior and sees no Organisation,
member, job, transaction, or email data.

## Run 4 — Membership changes and ownership

### STG-18: Owner promotes and demotes

1. As OWNER, promote MEMBER to Admin.
2. Confirm MEMBER receives Admin controls.
3. Demote MEMBER to Member.
4. Confirm Admin controls disappear.

Expected: role and available actions update immediately after refresh.

### STG-19: Owner protection

Try to remove or directly demote OWNER.

Expected: the operation is rejected.

### STG-20: Ownership transfer

1. As OWNER, transfer ownership to ADMIN.
2. Refresh both sessions.

Expected:

- ADMIN becomes the only Owner;
- former OWNER becomes Admin;
- former OWNER cannot transfer ownership or delete;
- new OWNER can perform owner-only actions.

For the remainder of the run, “OWNER” means the newly transferred Owner unless
the scenario explicitly says former OWNER.

### STG-21: Removed member loses access

1. Open the Organisation workspace as MEMBER.
2. In another session, remove MEMBER.
3. Refresh MEMBER's open page and attempt a direct API-backed action.

Expected: access disappears immediately; an already-open page cannot be used to
perform a mutation.

## Run 5 — Organisation jobs

### STG-22: Post public paid job

As a current Member, create:

- Title: `Public Organisation Job <run suffix>`;
- an ordinary manual-labour category;
- a valid description, budget, rate type, and future deadline.

Expected:

- the job appears in the Organisation workspace;
- the total job count increments;
- the latest-job list shows the job;
- the posting member's personal role remains unchanged.

### STG-23: Public discovery and application

1. Sign in as APPLICANT.
2. Find and open the public job.
3. Submit an application.
4. Return as an Organisation Member and open applicants.

Expected: APPLICANT can apply once and an authorized Organisation Member can
view the application.

### STG-24: Another member manages the job

Have an Organisation Member other than the poster edit a permitted field on
the open job.

Expected: the edit succeeds and is visible after refresh.

### STG-25: Outsider cannot manage the job

As OUTSIDER, try the copied management/edit URL.

Expected: no management data or mutation capability is exposed.

### STG-26: Remove original poster

1. Post another Organisation job as a removable Member.
2. Remove that Member.
3. As Owner/Admin, open and manage the job.
4. As the removed poster, retry the saved management URL.

Expected:

- the Organisation retains the job;
- current Owner/Admin can manage it;
- the removed poster can no longer manage it.

### STG-27: Direct/private job

Create a direct job request as the Organisation and verify another authorized
Organisation member can open and manage it.

Expected: the direct job is not exposed to unrelated users but remains
manageable by current authorized Organisation members.

## Run 6 — Payments and transactions

Use staging Stripe test mode only. Confirm the browser displays test-mode
payment behavior before proceeding.

### STG-28: Original poster pays

1. On the public job, select APPLICANT as the same member who posted it.
2. Complete payment using the project's approved Stripe test credentials.
3. Refresh the job and Organisation transaction page.

Expected:

- payment attempt succeeds;
- exactly one held transaction exists;
- job becomes in progress with APPLICANT;
- the transaction appears once.

### STG-29: Different member pays — known failing scenario

Repeat selection/payment on another job as an authorized Member who did not
post that job.

Current expected result: this may fail during finalization because payment
ownership has not yet been redesigned. Record the PaymentIntent ID, exact UI
result, and time. Do not repeat payment after an unexpected result.

This scenario must pass before Organisation Phase 1 is released.

### STG-30: Completion and approval

1. APPLICANT marks the funded job complete.
2. An authorized Organisation member approves it.
3. Refresh job and transaction pages.

Expected:

- approval occurs once;
- transaction changes from held to released;
- released-spend aggregate updates accurately;
- repeated approval does not duplicate transfer or completion count.

### STG-31: Transaction pagination and isolation

If staging has enough test transactions, move between pages. Otherwise record
this scenario as blocked by insufficient fixture volume.

Expected: at most 50 rows per page, no duplicates across unchanged pages, and
no transactions from another Organisation.

## Run 7 — Deletion

### STG-32: Deletion blocked by active job

As current Owner, attempt to delete while an open/in-progress/completed/disputed
Organisation job exists.

Expected: deletion is rejected and the Organisation remains accessible.

### STG-33: Successful deletion

Only run this at the end. Resolve or cancel every active job, then delete.

Expected:

- deletion succeeds;
- the Organisation disappears from every member's switcher;
- old workspace URLs reveal no data;
- personal Client/Kinglancer workspaces remain available.

## Exit criteria

Record one of Pass, Fail, or Blocked for STG-01 through STG-33.

Do not release Phase 1 when:

- any authorization-isolation test fails;
- Organisation creation can leave partial records;
- invitation acceptance creates duplicates;
- ownership does not leave exactly one Owner;
- removed members retain mutation access;
- a Stripe payment succeeds but internal state is inconsistent;
- STG-29 remains failing;
- deletion bypasses active-job protection.
