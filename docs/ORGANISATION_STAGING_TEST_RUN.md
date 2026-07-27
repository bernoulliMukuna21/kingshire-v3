# Organisation Phase 1 staging test run

Target: `https://staging.kingshire.uk`

This is a browser-led test run for a human tester. It is different from the
unit and database scenario catalogue. Record the application commit and confirm
migrations 029, 030 and 031 were successfully applied to the staging Supabase
project before starting.

## Before testing

The Organisation navigation must be visible after sign-in. If it is not,
confirm that:

1. the Organisation application changes are deployed to staging;
2. migrations `029_organisation_foundation.sql`,
   `030_make_organisation_email_optional.sql` and
   `031_organisation_subscriptions.sql` are applied to staging;
3. the staging deployment has its Supabase URL, publishable key, and secret
   key;
4. the three Organisation Stripe test Price IDs and webhook secret are set;
5. the Stripe test webhook includes Checkout and subscription events;
6. the Stripe test Customer Portal is enabled;
7. the deployment health check is passing.

Do not run these scenarios against production.

## Test accounts

Use six confirmed staging accounts. Do not share passwords in this document.

| Label       | Personal role | Purpose                                                     |
| ----------- | ------------- | ----------------------------------------------------------- |
| OWNER       | Client        | Creates and owns the Organisation                           |
| ADMIN       | Client        | Tests delegated administration                              |
| MEMBER      | Client        | Tests ordinary Organisation job management                  |
| KING-MEMBER | Kinglancer    | Proves Organisation membership does not alter personal role |
| APPLICANT   | Kinglancer    | Applies to Organisation jobs                                |
| OUTSIDER    | Client        | Tests unauthorized access                                   |

Use a unique run suffix, for example `20260725-01`. Name the Organisation:

`Staging Test Organisation 20260725-01`

Use the same suffix in job titles. This makes test data identifiable and avoids
collisions with earlier runs.

## Evidence sheet

For every scenario record:

| ID              | Result            | Notes/evidence                                            |
| --------------- | ----------------- | --------------------------------------------------------- |
| Example: STG-01 | Pass/Fail/Blocked | Screenshot, URL, visible error, Stripe ID, or defect link |

If a test fails, record the exact actor, page URL, action, expected result,
actual result, and approximate time. Do not keep repeating payment actions
after an unexpected result.

## Run 1 — Creation and personal workspace

### STG-01: Create an Organisation

1. Sign in as OWNER.
2. Open **Organisations** from the dashboard navigation.
3. Select **Create Organisation**.
4. Complete the guided identity and profile steps with:
   - Name: the unique test Organisation name;
   - Type: Company;
   - Website: a valid `https://` URL;
   - Location: London;
   - Country: United Kingdom;
   - Registration number: `STAGING-TEST`;
   - Description: `Organisation Phase 1 staging test`.
5. Select the Starter £10/month plan.
   Confirm the card explicitly shows 3 teammates plus the Owner, 1 active
   volunteer scheme, 2 active paid placement listings, 3 active participants
   and Basic reporting.
6. Review the recurring subscription and Owner notice.
7. Continue to Stripe and complete Checkout with test card
   `4242 4242 4242 4242`, any future expiry and any CVC.
8. Allow confirmation to finish, skip the invitation step and enter the
   workspace.

Expected:

- Stripe shows a £10 recurring monthly test subscription;
- the setup shell visibly progresses from Account through Organisation,
  Profile, Plan, Review and payment, Team and Complete;
- the desktop setup summary updates with the Organisation name and selected
  plan; on mobile, the compact step indicator updates instead;
- confirmation proceeds without a normal pending-approval screen;
- the optional invitation step appears;
- the Organisation workspace opens;
- the workspace identifies OWNER as `owner`;
- job count is 0;
- member count is 1;
- released spend is £0.00;
- no duplicate Organisation appears after refreshing;
- the Owner sees Starter, active and **Manage subscription** in the workspace.

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

Try an invalid one-character Organisation name and a website using a non-HTTP
protocol.

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

Only run this at the end. Resolve or cancel every active job. First confirm
deletion is blocked while the subscription is billable, then cancel the
subscription in Stripe's Customer Portal, process the cancellation webhook and
delete.

Expected:

- deletion succeeds;
- the Organisation disappears from every member's switcher;
- old workspace URLs reveal no data;
- personal Client/Kinglancer workspaces remain available.

## Run 8 — Subscription recovery and lifecycle

Use a second uniquely named Organisation draft so the main test workspace is
not disrupted.

### STG-34: Cancelled Checkout retains setup

Reach Stripe Checkout, use the browser's return/cancel action without paying
and return to KingsHire.

Expected: the cancellation notice appears, entered details and plan remain,
and no Organisation or Owner membership has been created.

### STG-35: Confirmation and webhook race

Complete Checkout once and record the Checkout Session, subscription and
Organisation IDs from Stripe, the browser and Supabase.

Expected: one setup draft maps to exactly one Organisation, one Owner and one
subscription even when both the return page and webhook process confirmation.

### STG-36: Browser does not return

Complete a new test Checkout and close the tab before KingsHire's return page
loads.

Expected: `checkout.session.completed` still creates the Organisation exactly
once and it appears on the Owner's next sign-in.

### STG-37: Stripe confirmation temporarily unavailable

In an isolated test deployment, temporarily use an invalid/restricted Stripe
secret after Checkout has been completed, then open the return URL.

Expected: bounded retries end in the recovery message; restoring the correct
key and choosing retry activates the same Checkout without another charge.

### STG-38: Billing Portal access control

Open **Manage subscription** as Owner, then attempt the billing API as Admin,
Member and Outsider.

Expected: Owner reaches the correct Stripe Customer Portal; every other role
receives a forbidden response and no customer information.

### STG-39: Inactive subscription blocks new work

Cancel a disposable Organisation subscription immediately in Stripe test mode
and allow the subscription webhook to arrive.

Expected: history and workspace access remain, but posting a new Organisation
job returns the reactivation message.

### STG-40: Signup image behaviour

Open Client, Kinglancer and Organisation signup on desktop. Observe for at
least ten seconds, then repeat with reduced motion enabled.

Expected: Client and Kinglancer images crossfade only inside the left visual
panel; Organisation retains its selected single image; copy and form remain
stationary; reduced motion freezes the first image.

## Exit criteria

Record one of Pass, Fail, or Blocked for STG-01 through STG-40.

Do not release Phase 1 when:

- any authorization-isolation test fails;
- Organisation creation can leave partial records;
- invitation acceptance creates duplicates;
- ownership does not leave exactly one Owner;
- removed members retain mutation access;
- a Stripe payment succeeds but internal state is inconsistent;
- a paid setup creates more than one Organisation, Owner or subscription;
- a non-Owner can open Organisation billing;
- a cancelled subscription can continue posting new Organisation jobs;
- STG-29 remains failing;
- deletion bypasses active-job protection.
