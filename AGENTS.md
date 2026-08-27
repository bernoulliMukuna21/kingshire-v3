<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Engineering conventions

Architecture: **modular monolith** (one Next.js app, one Supabase Postgres). Do
NOT introduce microservices or a client state store (Redux). The database is the
only cross-user source of truth; the browser holds ephemeral UI state only.

## Single source of truth — derive, don't duplicate

- A fact lives in one place (a DB column). Its _meaning_ is computed by exactly
  one function; every screen renders a projection of that function.
- Before adding logic, ask: "how many places already derive this fact?" If one
  exists, extend it — never copy it. Counts must be the length of the same list
  a page renders (see `lib/action-centre.ts`), not a separate re-computation.
- Status/label/badge/enum → text is derived in ONE `lib/` function per entity
  (e.g. `derivePlacementView`, `deriveAgreementView`). No `status === "x"` label
  maps scattered across pages.

## Supabase types & data access

- `lib/supabase/types.ts` is **generated** — never hand-edit it. Regenerate with
  `npm run gen:types` after any schema change; fix the type fallout it surfaces.
- `numeric` columns arrive as **strings** at runtime (the generated type says
  `number`, which lies). Coerce them at the read boundary with
  `coerceNumeric`/`coerceNumericList` (`lib/db/coerce.ts`) — never do money math
  on a raw column.
- `jsonb`/`text` columns generate as `Json`/`string`; narrow them once in `lib`
  (a domain type or parse helper), not with ad-hoc casts in pages.
- Know your client: the **cookie** client (`lib/supabase/server.ts`) enforces
  RLS; the **service** client (`lib/supabase/service.ts`) bypasses it. `lib/db/*`
  uses the service client, so authorization must be enforced in code there.

## Migrations

- Migrations applied ahead of code MUST be backward-compatible (no `NOT NULL` /
  dropped columns while old code is live). Additive changes only until deployed.
- Apply new migrations to the **staging** DB before relying on the column; the
  generated types will fail loudly if a referenced column is missing.

## Quality gate

- `npx tsc --noEmit`, `npx eslint`, and `npx vitest run --pool=threads` must all
  pass before a change is complete. New domain logic ships with unit tests.
