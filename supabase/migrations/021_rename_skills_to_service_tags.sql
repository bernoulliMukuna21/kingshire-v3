-- ============================================================
-- Migration 021: Rename skills fields to service terminology
-- Run this in Supabase → SQL Editor
-- ============================================================

alter table public.profiles
  rename column skills to service_tags;

alter table public.jobs
  rename column skills_required to service_tags_required;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, service_tags, phone)
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
      array(select jsonb_array_elements_text(new.raw_user_meta_data->'service_tags')),
      '{}'::text[]
    ),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;
