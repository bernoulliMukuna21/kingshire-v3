# Customer help, demo requests and feedback

The public contact page is `/contact`. It works without an account:

- `/contact?topic=account`: account and general help.
- `/contact?topic=payment`: job/payment help, with an optional reference.
- `/contact?topic=demo`: request a walkthrough; this does not book a time automatically.
- Feedback buttons open the published Tally form in a native in-page dialog.
  The floating launcher is dismissible for the current tab session. Footer,
  dashboard and contact-page buttons can reopen it after dismissal.
  Old `/contact?topic=feedback` links now show a local popup launcher; they do
  not redirect off the platform.

Navbar, footer and desktop/mobile dashboards link here. Dashboard links include
only the current pathname, never its query string. Changing contact topics keeps
that page context for native enquiries. Feedback links do not forward the
pathname, query string or account data to Tally.

Native help and demo submissions are saved in `support_enquiries` before the success response. Admins
with both an admin role and an active admin session can read and update them at
`/admin/support`. The reply link opens email; updating a status does not send a
message or claim a reply has been sent. Lists are paginated and filtered by status.

Inbox alerts go to the existing `SUPPORT_EMAIL` in `lib/contact.ts`. A receipt is
also emailed when a sender supplies an email. These use the existing Brevo setup
(`ENABLE_EMAIL=true`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, optionally
`BREVO_SENDER_NAME`). Staging should keep external email disabled. Messages remain
in the admin inbox if email is disabled or unavailable; alerts have an at-most-once
claim so retrying a submission does not send duplicate emails. An email outage
should be handled by checking the saved inbox, not repeatedly resubmitting.

The server validates submissions and checks the request origin. The database
serialises a five-submissions-per-hour limit per hashed sender and per supplied
email, with a UUID to deduplicate retries. No raw IP is stored. Anonymous and
ordinary signed-in database roles cannot read the inbox or bypass server
validation by calling its RPC. Admin status updates check the previous status to
avoid overwriting another operator's change.

## Deployment

Apply `supabase/migrations/080_support_enquiries.sql` to each target database
before deploying this code there. It is applied to staging; production has not
been changed. There is no migration history table on the linked staging project,
so this change was applied explicitly using `supabase db query --linked --file`.
Types were generated from staging with `npm run gen:types`'s underlying command.
`supabase/tests/support_enquiries.sql` verifies privacy, idempotency and rate
limits inside a rolled-back transaction.

Feedback is collected in the owner’s Tally workspace, separately from the native
support/demo inbox. There is no Tally webhook or response synchronisation, and
the Tally iframe is created only after an explicit click. No Tally widget script
is loaded on KingsHire pages. The iframe uses `referrerPolicy="no-referrer"` and
only fixed display options: account identity, page path and query parameters
are never added. Closing the native dialog restores keyboard focus and scroll
position. The native dialog traps focus. Escape works on the popup controls; keyboard
users inside the cross-origin form can Shift+Tab back to the always-visible
close button. Key events inside Tally’s document do not bubble to KingsHire. To receive alerts for feedback,
enable self email notifications in the Tally form’s settings. The native feedback
schema remains compatible with older requests and existing inbox records, but
all customer-facing feedback routes now use Tally.

No calendar is configured: the native demo form requests a time to be arranged
by email; it does not claim to book a slot.

## Money display

The admin overview and finance summary foreground available platform money after
reserving held payments. The competing "Earned to date" card has been removed.
Cash reservations use each matching Stripe receipt’s net amount and settlement
state. Pending job receipts are separate from settled company cash; when those
receipts settle their net amount is reserved until release. Approved, unpaid
worker shares remain reserved. There is no extra deduction of processing fees
and no hard-coded or artificially non-decreasing balance. Actual Stripe charges,
refunds and company withdrawals can still change company money.

## Homepage audience and community news

`getHomepageProgress` supplies both the hero counters and the news bar. User
counts exclude admins; the completed-job achievement uses the same public
`profiles.jobs_completed` fact shown on Kinglancer profiles. Placement stories
use `listPublicPlacements`, so draft/private opportunities are not announced.
Internships are identified by the word "internship" in a public placement title;
there is no separate internship entity in the current schema. Missing or zero
milestones are omitted. Facts are cached for one hour; audience selection is
client-side and is never part of the shared cache.

`homeAudience` is the single audience decision. Demo invitations are shown only
after authentication resolves, for visitors and personal clients. Organisation
membership is checked through the signed-in cookie client under RLS. Kinglancers
see opportunities first, clients see community hiring achievements, and existing
organisation members get team-workspace updates. Existing organisations do not
receive the setup/demo invitation.

The moving news strip pauses on hover or keyboard focus, has a pause control,
and becomes a manually scrollable static strip under reduced-motion settings.
Duplicated animation content is hidden from assistive technology and excluded
from keyboard tab order; visible repeated links remain clickable.
