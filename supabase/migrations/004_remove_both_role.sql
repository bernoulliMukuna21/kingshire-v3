-- Migration 004: Remove 'both' from profiles.role and normalize existing data

-- Normalize any unexpected role values before tightening the constraint.
update public.profiles p
set role = case
  when exists (
    select 1
    from public.applications a
    where a.kinglancer_id = p.id
  ) then 'kinglancer'
  when exists (
    select 1
    from public.jobs j
    where j.client_id = p.id
  ) then 'client'
  else 'client'
end
where role is null or role not in ('client', 'kinglancer');

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'kinglancer'));

alter table public.profiles
  alter column role set default 'client';

alter table public.profiles
  alter column role set not null;
