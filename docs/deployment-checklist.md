# Deployment Checklist

Use this checklist for both staging and production.

## 1. Supabase

- Create a separate Supabase project per environment.
- For a fresh project, bootstrap with `supabase/schema.sql`.
- Do not run historical migrations `002` through `019` on top of `schema.sql`; they are the evolution history for the existing database.
- Future schema changes should be new migrations after `019` and applied to both staging and production.
- Create the public `avatars` storage bucket.
- Add Auth redirect URLs:
  - `<APP_URL>/auth/callback`
  - `<APP_URL>/reset-password`
- Copy the environment-specific URL, publishable key, and service key into Railway.

## 2. Stripe

- Use test-mode keys for staging.
- Use live-mode keys only for production.
- Create a webhook endpoint:
  - `<APP_URL>/api/webhooks/stripe`
- Subscribe at minimum to:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `account.updated`
- Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3. Google OAuth

- In Google Cloud Console, configure an OAuth 2.0 Web Client.
- Add the Supabase project callback URL as the authorized redirect URI:
  - `https://<project-ref>.supabase.co/auth/v1/callback`
- In Supabase Auth Providers, enable Google and add the client ID/secret.
- In Supabase URL Configuration, add the app callback URL:
  - `<APP_URL>/auth/callback`

## 4. Brevo Email

- Verify the sender address in Brevo.
- Set:
  - `BREVO_API_KEY`
  - `BREVO_SENDER_NAME`
  - `BREVO_SENDER_EMAIL`
  - `ADMIN_NOTIFICATION_EMAIL`
- For MVP, the KingsHire Gmail address can be used if Brevo accepts it as a verified sender.

## 5. Railway

- Create one web service from the repo.
- Set variables from `.env.example`.
- Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the Railway public URL or custom domain.
- Confirm `/api/health` returns `200`.

## 6. Cron Services

- Create a Railway cron service for `npm run cron:auto-release`.
- Create a Railway cron service for `npm run cron:cleanup-abandoned-checkouts`.
- Use the schedules in `docs/railway-deployment.md`.
- Confirm both cron services use the same environment variables as the web service.

## 7. Smoke Test

- Sign up as a client.
- Sign up as a kinglancer.
- Complete kinglancer onboarding/profile setup.
- Post a job.
- Apply to the job.
- Accept applicant and complete Stripe test payment.
- Confirm transaction moves to `held`.
- Mark work complete as kinglancer.
- Approve work as client.
- Confirm transaction moves to `released`.
- Confirm Stripe transfer is created for an onboarded kinglancer.
- Test abandoned checkout cleanup with an unpaid selection.
- Test account deletion request link from settings.
