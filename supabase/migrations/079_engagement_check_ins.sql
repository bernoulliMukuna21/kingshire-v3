begin;

-- Generic check-in feed for any `engagements` row (roles today; placements
-- could migrate onto this later instead of their own placement_check_ins
-- table, once there's a safe path to move existing rows). Roles previously
-- had no equivalent of placements' "post an update / ask a question" feed.
create table public.engagement_check_ins (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index engagement_check_ins_engagement_idx
  on public.engagement_check_ins (engagement_id, created_at desc);

alter table public.engagement_check_ins enable row level security;

create policy "Read engagement check-ins as participant or org member"
  on public.engagement_check_ins
  for select using (
    exists (
      select 1 from public.engagements e
      where e.id = engagement_check_ins.engagement_id
        and (
          e.kinglancer_id = auth.uid()
          or exists (
            select 1 from public.organisation_members
            where organisation_id = e.organisation_id
              and user_id = auth.uid()
          )
        )
    )
  );

-- Reads for authenticated users (RLS-scoped above); all writes via service role.
grant select on public.engagement_check_ins to authenticated;
grant all on public.engagement_check_ins to service_role;

commit;
