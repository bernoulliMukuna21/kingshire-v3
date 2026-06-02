-- ============================================================
-- Migration 017: Close job update policy old-row gap
-- Run this in Supabase → SQL Editor
-- ============================================================

-- The previous policy only required the NEW row to be open in WITH CHECK.
-- That still allowed a client to update one of their non-open jobs by setting
-- status back to open in the same statement. Require the OLD row to be open
-- in USING as well, so direct client edits are limited to genuinely open jobs.
drop policy if exists "Clients can update own jobs" on public.jobs;
create policy "Clients can update own jobs" on public.jobs
  for update using (auth.uid() = client_id AND status = 'open')
  with check (auth.uid() = client_id AND status = 'open');
