-- ============================================================
-- Migration 002: Notifications
-- Run in Supabase → SQL Editor
-- ============================================================

-- ── NOTIFICATIONS TABLE ────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in (
                'new_application',
                'job_awarded',
                'work_submitted',
                'payment_released',
                'dispute_raised'
              )),
  title       text not null,
  body        text not null,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications(user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────
alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users read own notifications'
  ) then
    create policy "Users read own notifications"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;
end
$$;

-- Users can mark their own notifications as read
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Users update own notifications'
  ) then
    create policy "Users update own notifications"
      on public.notifications for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- Service role inserts on behalf of the system (bypasses RLS)
-- No INSERT policy needed — service role always bypasses RLS
