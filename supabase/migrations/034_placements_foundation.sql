-- ============================================================
-- Migration 034: Placement foundation (Phase 2)
-- Run this in Supabase → SQL Editor (STAGING)
-- ============================================================
--
-- Placement Passport foundation: kinglancer opt-in, placement listings,
-- applications, agreements, milestones, check-ins and completion experience
-- records.
--
-- Scope decisions for this release:
--   * Placements are NON-MONETARY (value = training, mentoring, reference,
--     verified experience). No Stripe/escrow flow.
--   * A plan "seat" counts an ACTIVE PARTICIPANT (an agreement in 'active').
--   * Safety guards: 18+ is enforced elsewhere; weekly hours capped at 16,
--     duration capped at 26 weeks (~6 months).
--
-- All writes go through authenticated server routes using the service role,
-- consistent with the organisation domain. RLS below governs reads only.
-- ============================================================

alter table public.profiles
  add column if not exists open_to_placements boolean not null default false;

-- ── PLACEMENTS ────────────────────────────────────────────
create table public.placements (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 3 and 140),
  summary text not null check (char_length(summary) between 10 and 4000),
  categories text[] not null default '{}',
  contribution text not null check (char_length(contribution) between 10 and 4000),
  reward text not null check (char_length(reward) between 10 and 4000),
  location text,
  is_remote boolean not null default false,
  weekly_hours int not null default 8 check (weekly_hours between 1 and 16),
  duration_weeks int not null default 8 check (duration_weeks between 1 and 26),
  start_date date,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'open', 'closed', 'cancelled')),
  requires_manual_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index placements_org_status_idx
  on public.placements (organisation_id, status, created_at desc);
create index placements_open_idx
  on public.placements (status, created_at desc) where status = 'open';

-- ── PLACEMENT APPLICATIONS ────────────────────────────────
create table public.placement_applications (
  id uuid primary key default uuid_generate_v4(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, kinglancer_id)
);

create index placement_applications_kinglancer_idx
  on public.placement_applications (kinglancer_id, created_at desc);

-- ── PLACEMENT AGREEMENTS ──────────────────────────────────
-- One per accepted participant. Both sides declare and accept the terms; a
-- material change bumps version and requires re-acceptance.
create table public.placement_agreements (
  id uuid primary key default uuid_generate_v4(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  version int not null default 1,
  contribution_terms text not null,
  reward_terms text not null,
  weekly_hours int not null check (weekly_hours between 1 and 16),
  duration_weeks int not null check (duration_weeks between 1 and 26),
  status text not null default 'pending_acceptance'
    check (status in ('pending_acceptance', 'active', 'completed', 'cancelled')),
  org_signed_by uuid references public.profiles(id),
  org_signed_at timestamptz,
  kinglancer_signed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, kinglancer_id)
);

create index placement_agreements_org_status_idx
  on public.placement_agreements (organisation_id, status);
create index placement_agreements_kinglancer_idx
  on public.placement_agreements (kinglancer_id, status);

-- Active participant = an agreement currently 'active'. Plan seats count these.
create index placement_agreements_active_seat_idx
  on public.placement_agreements (organisation_id)
  where status = 'active';

-- ── PLACEMENT MILESTONES ──────────────────────────────────
create table public.placement_milestones (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null references public.placement_agreements(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index placement_milestones_agreement_idx
  on public.placement_milestones (agreement_id, created_at);

-- ── PLACEMENT CHECK-INS ───────────────────────────────────
create table public.placement_check_ins (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid not null references public.placement_agreements(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index placement_check_ins_agreement_idx
  on public.placement_check_ins (agreement_id, created_at desc);

-- ── EXPERIENCE RECORDS ────────────────────────────────────
-- Completion output shown on the kinglancer public profile (Placement
-- Passport). Kept separate from paid-job ratings.
create table public.experience_records (
  id uuid primary key default uuid_generate_v4(),
  agreement_id uuid references public.placement_agreements(id) on delete set null,
  placement_id uuid references public.placements(id) on delete set null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kinglancer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text,
  skills text[] not null default '{}',
  outcome text,
  reference_text text,
  is_public boolean not null default true,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index experience_records_kinglancer_public_idx
  on public.experience_records (kinglancer_id, completed_at desc)
  where is_public;

-- ── updated_at triggers ───────────────────────────────────
create trigger on_placements_updated
  before update on public.placements
  for each row execute function public.handle_updated_at();
create trigger on_placement_applications_updated
  before update on public.placement_applications
  for each row execute function public.handle_updated_at();
create trigger on_placement_agreements_updated
  before update on public.placement_agreements
  for each row execute function public.handle_updated_at();

-- ── RLS (reads) ───────────────────────────────────────────
alter table public.placements enable row level security;
alter table public.placement_applications enable row level security;
alter table public.placement_agreements enable row level security;
alter table public.placement_milestones enable row level security;
alter table public.placement_check_ins enable row level security;
alter table public.experience_records enable row level security;

create policy "Read open or own-org placements" on public.placements
  for select using (
    status = 'open'
    or exists (
      select 1 from public.organisation_members
      where organisation_id = placements.organisation_id
        and user_id = auth.uid()
    )
  );

create policy "Read own or org placement applications"
  on public.placement_applications
  for select using (
    kinglancer_id = auth.uid()
    or exists (
      select 1
      from public.placements p
      join public.organisation_members m
        on m.organisation_id = p.organisation_id
      where p.id = placement_applications.placement_id
        and m.user_id = auth.uid()
    )
  );

create policy "Read own or org placement agreements"
  on public.placement_agreements
  for select using (
    kinglancer_id = auth.uid()
    or exists (
      select 1 from public.organisation_members
      where organisation_id = placement_agreements.organisation_id
        and user_id = auth.uid()
    )
  );

create policy "Read placement milestones via agreement"
  on public.placement_milestones
  for select using (
    exists (
      select 1 from public.placement_agreements a
      where a.id = placement_milestones.agreement_id
        and (
          a.kinglancer_id = auth.uid()
          or exists (
            select 1 from public.organisation_members
            where organisation_id = a.organisation_id
              and user_id = auth.uid()
          )
        )
    )
  );

create policy "Read placement check-ins via agreement"
  on public.placement_check_ins
  for select using (
    exists (
      select 1 from public.placement_agreements a
      where a.id = placement_check_ins.agreement_id
        and (
          a.kinglancer_id = auth.uid()
          or exists (
            select 1 from public.organisation_members
            where organisation_id = a.organisation_id
              and user_id = auth.uid()
          )
        )
    )
  );

create policy "Read public experience records"
  on public.experience_records
  for select using (is_public or kinglancer_id = auth.uid());

-- ── Grants (writes via service role) ──────────────────────
grant select on public.placements to authenticated;
grant select on public.placement_applications to authenticated;
grant select on public.placement_agreements to authenticated;
grant select on public.placement_milestones to authenticated;
grant select on public.placement_check_ins to authenticated;
grant select on public.experience_records to authenticated;

grant all on public.placements to service_role;
grant all on public.placement_applications to service_role;
grant all on public.placement_agreements to service_role;
grant all on public.placement_milestones to service_role;
grant all on public.placement_check_ins to service_role;
grant all on public.experience_records to service_role;
