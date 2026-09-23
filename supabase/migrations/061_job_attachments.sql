-- Optional supporting documents for subscribed Organisation jobs.
-- Apply to staging before deploying code. Existing jobs remain unchanged.
alter table public.jobs add column if not exists attachment jsonb;
alter table public.jobs add constraint jobs_attachment_organisation_check
  check (attachment is null or organisation_id is not null);

-- Only server routes may set attachment metadata. In particular, personal
-- clients cannot bypass the subscription check through the Supabase REST API.
create or replace function public.guard_job_attachment()
returns trigger language plpgsql set search_path = public as $$
begin
  if (TG_OP = 'INSERT' and new.attachment is not null)
     or (TG_OP = 'UPDATE' and new.attachment is distinct from old.attachment) then
    if auth.role() is distinct from 'service_role' then
      raise exception 'Attachments must be managed through the job posting service';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_job_attachment
  before insert or update on public.jobs
  for each row execute function public.guard_job_attachment();

-- No browser storage policies: uploads and authorised downloads use the
-- service client. Private requests must never expose a public storage URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-attachments', 'job-attachments', false, 3145728, array[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
])
on conflict (id) do nothing;
