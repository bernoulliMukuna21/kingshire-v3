# Supabase Setup

## Existing Environments

For environments that already have the base schema, apply new migrations in
order.

## Fresh Staging/Production Project

This repo currently does not contain a `001` base migration. The migration files
`002` through `019` are historical deltas from the existing database.

For a brand-new Supabase project:

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Create the public `avatars` storage bucket.
3. Configure Auth redirect URLs for the environment.
4. Treat future migrations as `020+` and apply them to every environment.

Do not run migrations `002` through `019` on top of `schema.sql` in a fresh
project.
