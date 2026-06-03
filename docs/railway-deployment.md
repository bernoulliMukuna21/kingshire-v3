# Railway Deployment

This app deploys on Railway as a standard Next.js service.

## Web Service

- Build command: `npm run build`
- Start command: `npm run start`
- Config file: `railway.toml`
- Healthcheck path: `/api/health`

Set production/staging variables in Railway, not in `.env.local`.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `APP_ENV`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `BREVO_API_KEY`
- `BREVO_SENDER_NAME`
- `BREVO_SENDER_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- `ADMIN_PASSCODE`
- `ADMIN_SESSION_SECRET`

`APP_URL` and `NEXT_PUBLIC_APP_URL` should both point to the Railway public URL
or custom domain for the current environment.

`<STAGING_APP_URL>` in the staging docs means this same Railway public URL; it
is not a separate environment variable.

`ADMIN_PASSCODE` is required for `/admin/login`, and `ADMIN_SESSION_SECRET`
signs the short-lived admin cookie. Admin users are controlled internally with
`profiles.role = 'admin'`.

## Cron Services

Railway cron jobs run a service start command on a schedule. Create separate
Railway services from the same repo and override the start command:

- Auto release: `npm run cron:auto-release`
- Cleanup abandoned checkouts: `npm run cron:cleanup-abandoned-checkouts`

Recommended schedules:

- Auto release: `0 9 * * 1-5`
- Cleanup abandoned checkouts: `*/30 * * * *`

Both cron commands call the existing protected API routes with:

- `Authorization: Bearer <CRON_SECRET>`

Keep `CRON_SECRET` different between staging and production.
