-- Add Stripe Connect fields to profiles
alter table public.profiles
  add column stripe_account_id         text,
  add column stripe_onboarding_complete boolean not null default false;

-- Track whether the platform has transferred the funds to the kinglancer
alter table public.transactions
  add column stripe_transfer_id text;
