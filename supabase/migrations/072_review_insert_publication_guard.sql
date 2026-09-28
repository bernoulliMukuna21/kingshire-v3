-- ============================================================
-- Close a review double-blind bypass via direct REST insert
-- ============================================================
-- "Users can leave a review" only checked reviewer/reviewee/job matching —
-- it never constrained is_published/published_at, so a direct PostgREST
-- insert (bypassing app/api/jobs/[id]/review/route.ts, which always uses
-- the service role and never sets these) could self-publish a review
-- immediately, defeating the double-blind window (hidden until both sides
-- submit or 7 days pass). The app's own reveal logic runs as service role
-- and is unaffected by this RLS tightening.
drop policy if exists "Users can leave a review" on public.reviews;
create policy "Users can leave a review" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    AND reviewer_id <> reviewee_id
    AND is_published = false
    AND published_at is null
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
