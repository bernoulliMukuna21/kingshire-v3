-- ============================================================
-- Migration 020: Add internal admin profile role
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Admin is now a real internal profile role, but it must never be assignable
-- through public sign-up metadata. Admin assignment should be done manually by
-- a trusted operator using the Supabase dashboard/SQL editor or service role.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('client', 'kinglancer', 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, skills, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when nullif(new.raw_user_meta_data->>'role', '') in ('client', 'kinglancer')
        then nullif(new.raw_user_meta_data->>'role', '')
      else null
    end,
    coalesce(
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'skills')),
      '{}'::text[]
    ),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;
