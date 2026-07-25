# Organisation Phase 1 test scenarios

This matrix defines what must be tested before Organisation Phase 1 can be
released. `ORGANISATION_PHASE1_ACCEPTANCE.md` explains the accounts, execution
order, and post-test data checks.

## Result recording

Record these fields for every database/browser scenario:

- scenario ID;
- environment and application commit;
- migration version;
- tester and execution time;
- pass/fail;
- observed result;
- screenshot, trace, SQL output, Stripe ID, or log correlation ID;
- defect link where applicable.

A scenario is not passed merely because the UI displays success. Confirm the
database invariant and any relevant side effect.

## Automated domain and validation scenarios

| ID | Scenario | Expected |
|---|---|---|
| ORG-U01 | Create with normalized name/default country | One normalized repository command |
| ORG-U02 | Create with invalid name | Rejected before persistence |
| ORG-U03 | Create with unsupported Organisation type | Rejected before persistence |
| ORG-U04 | Create with non-HTTP website protocol | Rejected before persistence |
| ORG-U05 | Admin invites Member | Allowed |
| ORG-U06 | Admin invites Admin | Forbidden |
| ORG-U07 | Member invites anyone | Forbidden |
| ORG-U08 | Malformed invitation token | Rejected before persistence |
| ORG-U09 | Admin updates Organisation profile | Allowed |
| ORG-U10 | Member updates Organisation profile | Forbidden |
| ORG-U11 | Admin transfers ownership | Forbidden |
| ORG-U12 | Owner transfers to self | Rejected |
| ORG-U13 | Owner requests Organisation deletion | Delegated to atomic command |
| ORG-U14 | Admin changes another Admin | Forbidden |
| ORG-U15 | Owner is removed or demoted directly | Rejected |
| ORG-U16 | Removed original poster manages Organisation job | Forbidden |
| ORG-U17 | Personal client manages personal job | Allowed |

## Migration and database scenarios

Run these against a disposable or dedicated test Supabase project after
migration 029 is applied.

| ID | Setup/action | Expected database result |
|---|---|---|
| ORG-D01 | Execute `create_organisation_with_owner` | Organisation and exactly one Owner commit |
| ORG-D02 | Force Owner insert failure during creation | Neither Organisation nor membership remains |
| ORG-D03 | Accept a valid invitation | Membership and `accepted_at` commit together |
| ORG-D04 | Accept the same invitation twice | First succeeds; second fails without duplicate membership |
| ORG-D05 | Send two concurrent acceptance requests | Exactly one membership; invitation consumed once |
| ORG-D06 | Accept with a different email | No membership or invitation mutation |
| ORG-D07 | Accept an expired invitation | No membership or invitation mutation |
| ORG-D08 | Transfer ownership | New Owner plus former Owner as Admin |
| ORG-D09 | Send concurrent ownership transfers | Transactional outcome with exactly one Owner |
| ORG-D10 | Delete while active job exists | Deletion rejected |
| ORG-D11 | Delete with no active jobs | `deleted_at` set and workspace hidden |
| ORG-D12 | Call service-only RPC as `anon` | Permission denied |
| ORG-D13 | Call service-only RPC as `authenticated` | Permission denied |
| ORG-D14 | Query membership by `user_id` with representative volume | Uses `organisation_members_user_joined_idx` |
| ORG-D15 | Query latest Organisation jobs | Uses Organisation creation-date index |
| ORG-D16 | Aggregate more than 50 jobs | Exact job/member/spend totals |
| ORG-D17 | Fetch transaction page for an Organisation | Only its transactions, at most 50 rows |
| ORG-D18 | Fetch second transaction page | No overlap or missing rows in unchanged data |

Use `EXPLAIN (ANALYZE, BUFFERS)` for D14 and D15 with production-like row
counts. Tiny fixtures cannot prove index effectiveness because PostgreSQL may
correctly choose a sequential scan.

## Authentication and authorization scenarios

| ID | Actor/action | Expected |
|---|---|---|
| ORG-A01 | Signed-out user opens Organisation dashboard | Redirect to sign-in |
| ORG-A02 | Outsider opens Organisation by guessed UUID | Not found/no data disclosed |
| ORG-A03 | Owner edits profile | Allowed |
| ORG-A04 | Admin edits profile | Allowed |
| ORG-A05 | Member edits profile | Forbidden |
| ORG-A06 | Owner invites Admin or Member | Allowed |
| ORG-A07 | Admin invites Member | Allowed |
| ORG-A08 | Admin invites Admin | Forbidden |
| ORG-A09 | Member invites | Forbidden |
| ORG-A10 | Owner promotes/demotes non-Owner | Allowed |
| ORG-A11 | Admin manages Member | Allowed |
| ORG-A12 | Admin manages Admin | Forbidden |
| ORG-A13 | Any actor directly removes Owner | Rejected |
| ORG-A14 | Removed member uses an already-open browser tab/API call | Forbidden immediately |
| ORG-A15 | Kinglancer joins Organisation | Personal Kinglancer role unchanged |
| ORG-A16 | Client joins Organisation | Personal Client role unchanged |
| ORG-A17 | Deleted Organisation member follows old URL | Not found/no data disclosed |

## Invitation scenarios

| ID | Scenario | Expected |
|---|---|---|
| ORG-I01 | Invite an existing non-member | Invitation created |
| ORG-I02 | Invite an existing member | Conflict; no invitation |
| ORG-I03 | Repeat a pending invitation | Conflict; one pending invitation |
| ORG-I04 | Reinvite after expiry | Expired record replaced; new token works |
| ORG-I05 | Invalid email | Rejected before persistence/email |
| ORG-I06 | Matching account accepts | Workspace becomes available |
| ORG-I07 | Wrong account accepts | Forbidden; invitation remains usable |
| ORG-I08 | Signed-out visitor follows token | Returns to token after sign-in |
| ORG-I09 | Email provider fails | Invitation remains usable and link is shown |
| ORG-I10 | Unknown/malformed token | Safe invalid/expired response |

## Workspace and query scenarios

| ID | Scenario | Expected |
|---|---|---|
| ORG-Q01 | User belongs to no Organisations | Empty state and create action |
| ORG-Q02 | User belongs to one Organisation | Personal and Organisation switching works |
| ORG-Q03 | User belongs to more than four Organisations | Switcher bounded; full list shows all |
| ORG-Q04 | Organisation has no jobs/transactions | Correct empty states |
| ORG-Q05 | Organisation has 75 jobs | Exact total; dashboard displays latest 20 |
| ORG-Q06 | Organisation has 125 transactions | Three pages; no cross-Organisation rows |
| ORG-Q07 | Released, held, refunded transactions coexist | Released-spend total includes released only |
| ORG-Q08 | Member count approaches UI limit | Exact aggregate remains correct |

## Ordinary paid-job scenarios

These scenarios test the current Phase 1 job integration. Organisation payment
by a colleague other than the original poster is a known open defect and must
not be marked passed until the payment ownership work is completed.

| ID | Scenario | Expected/current status |
|---|---|---|
| ORG-J01 | Member posts public Organisation job | Organisation ID and creator recorded |
| ORG-J02 | Member posts direct/private Organisation job | Only relevant parties/members can view |
| ORG-J03 | Outsider edits/cancels Organisation job | Forbidden |
| ORG-J04 | Another current member edits job | Allowed by role |
| ORG-J05 | Original poster removed | Loses access; Organisation retains job |
| ORG-J06 | Kinglancer applies; Member views applicant | Allowed |
| ORG-J07 | Original poster selects and pays applicant | Existing Stripe test flow succeeds |
| ORG-J08 | Different Organisation member pays | **Known failing scenario; release blocker** |
| ORG-J09 | Kinglancer completes; authorised member approves | Payment release succeeds once |
| ORG-J10 | Concurrent/repeated approval | One release/transfer/counter increment |
| ORG-J11 | Organisation job disputed | Only job parties/authorised members can act |
| ORG-J12 | Transaction history after poster removal | Still visible to current Organisation members |

## Resilience and negative scenarios

| ID | Failure injected | Expected |
|---|---|---|
| ORG-R01 | Supabase unavailable during command | No false success; retry-safe response |
| ORG-R02 | Request body is malformed JSON | Structured 400 response |
| ORG-R03 | Request contains oversized fields | Rejected before persistence |
| ORG-R04 | User loses membership between page load and mutation | Mutation denied by authoritative command |
| ORG-R05 | Browser repeats POST after timeout | No duplicate Organisation/invitation acceptance |
| ORG-R06 | Email delivery times out | Core invitation state remains consistent |
| ORG-R07 | Two members edit profile concurrently | Defined last-write behavior; no partial record |
| ORG-R08 | Migration is partially/not applied | Readiness/deployment check prevents release |

## Release gate

Phase 1 can proceed only when:

- all ORG-U scenarios are automated and passing;
- all ORG-D, ORG-A, ORG-I, and ORG-Q scenarios pass in a test Supabase
  environment;
- ORG-J08 and the payment consistency scenarios are fixed and passing;
- no Severity 1 or Severity 2 defect remains open;
- migration, application commit, Stripe mode, and evidence are recorded.
## Public Organisation entry and onboarding

- **ORG-PUB-01:** The public desktop and mobile navigation show **For
  Organisations**, linking to `/for-organisations`.
- **ORG-PUB-02:** The homepage Organisation callout is visible without opening
  the Client signup flow and links to the Organisation landing page.
- **ORG-PUB-03:** **Get started** presents Client, Kinglancer and Organisation
  as three distinct intentions.
- **ORG-PUB-04:** A signed-out visitor choosing **Create your Organisation**
  sees Organisation-specific signup copy explaining that a personal Client
  account is created first.
- **ORG-PUB-05:** After email, Google or KingsChat authentication, a new
  Organisation founder reaches Client onboarding and then Organisation
  creation without losing the intended destination.
- **ORG-PUB-06:** A signed-in Client goes directly from
  `/organisations/start` to Organisation creation.
- **ORG-PUB-07:** A signed-in Kinglancer goes directly to Organisation creation
  without their Kinglancer role, services or profile being replaced.
- **ORG-PUB-08:** The Organisation landing page describes placements,
  subscriptions and verification as coming later, not currently available.
- **ORG-PUB-09:** The temporary Organisation announcement is shown to
  signed-out visitors and Clients, hidden from Kinglancers, dismissible, and
  no longer shown after 9 August 2026.
- **ORG-PUB-10:** The homepage no longer renders the permanent Organisation
  callout card. Its centred navy hero and floating profiles remain readable
  and respect reduced-motion settings.
- **ORG-PUB-11:** Organisation signup uses Organisation-specific photography
  and copy while retaining the standard KingsHire form controls.
- **ORG-PUB-12:** Remote photographs preserve their intended crop at desktop
  and mobile sizes, have meaningful alternative text, and produce no layout
  shift or image-optimizer errors.
