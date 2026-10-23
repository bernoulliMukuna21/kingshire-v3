# Customer help, demo requests and feedback

The public contact page is `/contact`. It works without an account:

- `/contact?topic=account`: account and general help.
- `/contact?topic=payment`: job/payment help, with an optional reference.
- `/contact?topic=demo`: request a walkthrough; this does not book a time automatically.
- Feedback links open the published Tally form at `https://tally.so/r/GexYZL`.
  Old `/contact?topic=feedback` links redirect there.

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
no Tally script is loaded on KingsHire pages. To receive alerts for feedback,
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
