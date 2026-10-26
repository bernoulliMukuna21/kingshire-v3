begin;
create table public.support_enquiries (
  id uuid primary key,
  topic text not null check (topic in ('account','payment','demo','feedback')),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  name text not null default '' check (length(name) <= 100),
  email text not null default '' check (length(email) <= 254),
  organisation text not null default '' check (length(organisation) <= 160),
  reference text not null default '' check (length(reference) <= 120),
  message text not null check (length(btrim(message)) between 10 and 5000),
  source_path text not null default '' check (length(source_path) <= 300),
  sender_hash text not null,
  inbox_email_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_enquiries_status_created on public.support_enquiries(status,created_at desc);
create index support_enquiries_sender_created on public.support_enquiries(sender_hash,created_at desc);
create index support_enquiries_email_created on public.support_enquiries(email,created_at desc);
alter table public.support_enquiries enable row level security;
revoke all on public.support_enquiries from anon, authenticated;
grant all on public.support_enquiries to service_role;
create trigger support_enquiries_updated before update on public.support_enquiries for each row execute function public.handle_updated_at();

-- Only the server may submit. Serialised limits and a caller UUID make retrying
-- a lost response safe without depending on a particular web server instance.
create function public.submit_support_enquiry(p_id uuid,p_topic text,p_name text,p_email text,p_organisation text,p_reference text,p_message text,p_source_path text,p_sender_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.support_enquiries;
begin
  perform pg_advisory_xact_lock(hashtextextended('support:'||p_sender_hash,0));
  if p_email <> '' then perform pg_advisory_xact_lock(hashtextextended('support-email:'||p_email,0)); end if;
  select * into existing from public.support_enquiries where id=p_id;
  if found then
    if existing.sender_hash <> p_sender_hash then raise exception 'Submission conflict' using errcode='23505'; end if;
    return existing.id;
  end if;
  if (select count(*) from public.support_enquiries where sender_hash=p_sender_hash and created_at > now()-interval '1 hour') >= 5
    or (p_email <> '' and (select count(*) from public.support_enquiries where email=p_email and created_at > now()-interval '1 hour') >= 5) then
    raise exception 'Too many requests' using errcode='P0001';
  end if;
  insert into public.support_enquiries(id,topic,name,email,organisation,reference,message,source_path,sender_hash)
    values(p_id,p_topic,p_name,p_email,p_organisation,p_reference,p_message,p_source_path,p_sender_hash);
  return p_id;
end $$;
revoke all on function public.submit_support_enquiry(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_support_enquiry(uuid,text,text,text,text,text,text,text,text) to service_role;
commit;
