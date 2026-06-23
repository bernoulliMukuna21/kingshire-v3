-- ============================================================
-- Migration 026: Two-sided double-blind review system
-- Run this in Supabase → SQL Editor (PROD + STAGING)
-- ============================================================
--
-- Adds reveal state to reviews, recomputes profile aggregates from
-- PUBLISHED reviews only, auto-reveals when both parties have reviewed,
-- and exposes an RPC to reveal reviews whose 7-day window has elapsed.
--
-- Double-blind rules:
--   • A review is created hidden (is_published = false).
--   • When BOTH parties have reviewed a job, both reviews publish at once.
--   • If only one party reviews, their review publishes once the 7-day
--     window (from transactions.released_at) elapses; the silent party
--     forfeits their chance to review.
-- ============================================================

-- ── 1. Reveal columns ──────────────────────────────────────
alter table public.reviews
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at  timestamptz;

create index if not exists idx_reviews_reviewee_published
  on public.reviews (reviewee_id)
  where is_published;

create index if not exists idx_reviews_job_published
  on public.reviews (job_id, is_published);

-- ── 2. Aggregate recompute (published reviews only) ─────────
-- SECURITY DEFINER so it can write profiles.rating / total_reviews, which
-- are guarded against the authenticated role by restrict_profile_update.
create or replace function public.recompute_profile_rating(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.reviewee_id = target and r.is_published
    ), 0),
    total_reviews = (
      select count(*)
      from public.reviews r
      where r.reviewee_id = target and r.is_published
    )
  where p.id = target;
end;
$$;

-- ── 3. Recompute on publish ─────────────────────────────────
create or replace function public.on_review_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_published then
      perform public.recompute_profile_rating(new.reviewee_id);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_published and not old.is_published then
      perform public.recompute_profile_rating(new.reviewee_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_review_published on public.reviews;
create trigger trg_review_published
  after insert or update on public.reviews
  for each row execute function public.on_review_published();

-- ── 4. Auto-reveal when both parties have reviewed ──────────
-- Fires before trg_review_published alphabetically ('i' < 'p'), so the
-- UPDATE below drives the recompute for both rows.
create or replace function public.on_review_insert_try_reveal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.reviews r
    where r.job_id = new.job_id
      and r.reviewer_id = new.reviewee_id
      and r.reviewee_id = new.reviewer_id
  ) then
    update public.reviews
    set is_published = true,
        published_at = now()
    where job_id = new.job_id
      and is_published = false;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_review_insert_reveal on public.reviews;
create trigger trg_review_insert_reveal
  after insert on public.reviews
  for each row execute function public.on_review_insert_try_reveal();

-- ── 5. Reveal reviews past the 7-day window ─────────────────
-- Publishes any still-hidden review whose job was approved (payment
-- released) more than 7 calendar days ago. Returns the affected reviewee
-- ids so the caller can send "review received" notifications.
create or replace function public.reveal_expired_reviews()
returns table (review_id uuid, reviewee_id uuid, job_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.reviews r
  set is_published = true,
      published_at = now()
  from public.transactions t
  where t.job_id = r.job_id
    and r.is_published = false
    and t.released_at is not null
    and t.released_at < now() - interval '7 days'
  returning r.id, r.reviewee_id, r.job_id;
end;
$$;

-- ── 6. RLS: public can only read PUBLISHED reviews ──────────
-- Parties may still read their own hidden review (own reviewer_id), but a
-- hidden review about a user is not visible to anyone until revealed.
drop policy if exists "Reviews are public" on public.reviews;
create policy "Published reviews are public" on public.reviews
  for select using (
    is_published or auth.uid() = reviewer_id
  );

-- ── 7. Notification types ───────────────────────────────────
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_application',
    'job_awarded',
    'work_submitted',
    'payment_released',
    'dispute_raised',
    'new_job',
    'payout_ready',
    'direct_request',
    'review_request',
    'review_received'
  ));
