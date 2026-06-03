# Staging Environment Setup

Staging should be isolated from production:

- Separate Railway environment/service
- Separate Supabase project
- Stripe test-mode keys
- Separate `CRON_SECRET`
- Staging URL in Supabase Auth and Stripe webhook settings

In this guide, `<STAGING_APP_URL>` is a placeholder for the Railway public URL,
for example `https://kingshire-v3-staging.up.railway.app`. It is not a separate
environment variable. Put that value into both `APP_URL` and
`NEXT_PUBLIC_APP_URL`.

## 1. Create Supabase Staging

Create a new Supabase project, for example `kingshire-staging`.

For a fresh staging database, use the current schema baseline:

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Create a public Storage bucket named `avatars`.
4. Confirm the storage policies from `schema.sql` exist under Storage policies.

Do not run migrations `002` through `019` after running `schema.sql` on a fresh
project. Those migration files are historical deltas from the existing database,
and this repo currently has no `001` base migration. From this point forward,
new schema changes should be added as migrations `020+` and applied to both
staging and production.

## 2. Configure Supabase Auth

Add staging redirect URLs:

- `<STAGING_APP_URL>/auth/callback`
- `<STAGING_APP_URL>/reset-password`

If using email templates, confirm links point to the staging app URL during
staging tests.

## 3. Configure Google OAuth for Staging

Google OAuth is configured in two places: Google Cloud Console and Supabase.

In Google Cloud Console, create or update an OAuth 2.0 Web Client:

- Authorized redirect URI:
  - `https://<staging-project-ref>.supabase.co/auth/v1/callback`

Use the staging Supabase project ref, not the Railway app URL, for the Google
authorized redirect URI. Supabase receives the OAuth callback from Google, then
redirects the user back to the app URL allowed above.

In Supabase staging:

- Go to Authentication → Providers → Google.
- Enable Google.
- Add the Google OAuth client ID and client secret.
- Go to Authentication → URL Configuration.
- Set Site URL to `<STAGING_APP_URL>`.
- Add redirect URLs:
  - `<STAGING_APP_URL>/auth/callback`
  - `<STAGING_APP_URL>/reset-password`

## 4. Configure Railway Staging

Use `.env.staging.example` as the variable checklist.

Set:

- `APP_ENV=staging`
- `NEXT_PUBLIC_APP_URL=<STAGING_APP_URL>`
- `APP_URL=<STAGING_APP_URL>`
- Supabase variables from the staging Supabase project
- Stripe test-mode variables
- A staging-only `CRON_SECRET`
- Brevo variables if you want to test real email delivery
- Admin gate variables:
  - `ADMIN_PASSCODE=<strong-shared-admin-passcode>`
  - `ADMIN_SESSION_SECRET=<strong-random-staging-secret>`

Deploy the web service first and verify:

- `<STAGING_APP_URL>/api/health`

The JSON response should include:

- `"ok": true`
- `"environment": "staging"`

## 5. Configure Stripe Test Webhook

Create a Stripe test-mode webhook endpoint:

- `<STAGING_APP_URL>/api/webhooks/stripe`

Subscribe to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `account.updated`

Copy the webhook signing secret into Railway as `STRIPE_WEBHOOK_SECRET`.

## 6. Configure Brevo Email

For staging, Brevo can be left disabled by omitting `BREVO_API_KEY`. In-app
notifications will still work.

If testing email delivery, verify the sender in Brevo and set:

- `BREVO_API_KEY`
- `BREVO_SENDER_NAME=KingsHire`
- `BREVO_SENDER_EMAIL=kingshirecompany@gmail.com`
- `ADMIN_NOTIFICATION_EMAIL=kingshirecompany@gmail.com`

The Brevo account can be owned by the Bernoulli developer email; the sender
address can still be the KingsHire Gmail address once Brevo verifies it.

## 7. Configure Admin Access

The admin dashboard is protected by both the signed-in Supabase user's
`profiles.role = 'admin'` and a separate passcode. Non-admin profile roles are
redirected away from `/admin` and `/admin/login`.

To create a staging admin, create/sign in the admin account first, then update
that profile internally:

```sql
update public.profiles
set role = 'admin'
where email = 'kingshirecompany@gmail.com';
```

Set a different `ADMIN_PASSCODE` and `ADMIN_SESSION_SECRET` for production.

## 8. Configure Railway Cron Services

Create two Railway cron services from the same repo:

- `npm run cron:auto-release`
- `npm run cron:cleanup-abandoned-checkouts`

Use the schedules in `docs/railway-deployment.md`.

Both services need the same environment variables as the web service.
