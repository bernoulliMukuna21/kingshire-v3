-- New Google OAuth users signing in from the sign-in page have no role in
-- their metadata, so the trigger was defaulting them to 'client' and skipping
-- onboarding. Fix: make role nullable so the callback's existing
-- `if (!profile?.role) → /onboarding` check catches them.

-- 1. Drop NOT NULL + old default
alter table public.profiles
  alter column role drop not null,
  alter column role drop default;

-- 2. Recreate the check constraint to allow NULL (pending onboarding)
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('client', 'kinglancer'));

-- 3. Update trigger: insert NULL role when no role is in user metadata
--    (email sign-up always passes role in options.data; Google OAuth from
--     the sign-up page passes signup_role via URL and sets it in the callback)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, skills, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'role', ''),
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'skills')),
      '{}'::text[]
    ),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;
