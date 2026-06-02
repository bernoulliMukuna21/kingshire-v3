# KingsHire

KingsHire is a Next.js marketplace MVP with Supabase auth/database/storage,
Stripe payments, Stripe Connect payouts, scheduled payment maintenance jobs,
and Railway deployment support.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Local secrets should live in `.env.local`. Do not commit real environment
values.

## Deployment

This project is configured for Railway.

- Railway guide: `docs/railway-deployment.md`
- Staging guide: `docs/staging-environment.md`
- Deployment checklist: `docs/deployment-checklist.md`
- Env template: `.env.example`
- Staging env template: `.env.staging.example`

Railway web service:

```bash
npm run build
npm run start
```

Railway cron services:

```bash
npm run cron:auto-release
npm run cron:cleanup-abandoned-checkouts
```

## Supabase

For a fresh staging Supabase project, run `supabase/schema.sql` as the baseline.
Do not run historical migrations `002` through `019` on top of the baseline.

See `supabase/README.md`.
