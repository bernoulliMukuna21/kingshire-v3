-- Allow kinglancer to update status on jobs they are assigned to
-- (e.g. mark as completed, raise a dispute)
create policy "Kinglancers can update assigned jobs" on public.jobs
  for update using (auth.uid() = kinglancer_id);
