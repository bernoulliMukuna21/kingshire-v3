-- ============================================================
-- Migration 018: Tighten reviews and disputes RLS
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Reviews may only be created by a real party to an approved job, reviewing
-- the counterparty. This prevents arbitrary profile-rating manipulation.
drop policy if exists "Users can leave a review" on public.reviews;
create policy "Users can leave a review" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    AND reviewer_id <> reviewee_id
    AND exists (
      select 1 from public.jobs
      where jobs.id = reviews.job_id
        AND jobs.status = 'approved'
        AND (
          (jobs.client_id = reviews.reviewer_id AND jobs.kinglancer_id = reviews.reviewee_id)
          OR
          (jobs.kinglancer_id = reviews.reviewer_id AND jobs.client_id = reviews.reviewee_id)
        )
    )
  );

-- Disputes may only be viewed and created by real parties to the relevant job.
drop policy if exists "Parties can view disputes" on public.disputes;
create policy "Parties can view disputes" on public.disputes
  for select using (
    exists (
      select 1 from public.jobs
      where jobs.id = disputes.job_id
        AND (jobs.client_id = auth.uid() OR jobs.kinglancer_id = auth.uid())
    )
  );

drop policy if exists "Users can raise disputes" on public.disputes;
create policy "Users can raise disputes" on public.disputes
  for insert with check (
    auth.uid() = raised_by
    AND exists (
      select 1 from public.jobs
      where jobs.id = disputes.job_id
        AND jobs.status in ('in_progress', 'completed')
        AND (jobs.client_id = auth.uid() OR jobs.kinglancer_id = auth.uid())
    )
  );
