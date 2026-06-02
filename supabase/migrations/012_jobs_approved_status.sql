-- Add 'approved' as a valid job status (client has approved + released payment)
alter table public.jobs
  drop constraint jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('open','in_progress','completed','cancelled','disputed','approved'));
