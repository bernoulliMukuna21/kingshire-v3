-- Run against staging; all fixtures are rolled back and send no notifications.
begin;
do $$
declare saved uuid; again uuid; i integer;
begin
  if has_table_privilege('anon','public.support_enquiries','SELECT') or has_table_privilege('authenticated','public.support_enquiries','SELECT') then raise exception 'Inbox data is publicly readable'; end if;
  if has_function_privilege('anon','public.submit_support_enquiry(uuid,text,text,text,text,text,text,text,text)','EXECUTE') then raise exception 'Public submission bypasses server validation'; end if;
  saved := public.submit_support_enquiry('ad463989-195f-4f9b-9be4-765446da66af','feedback','','','','','Test feedback for the inbox.','/','support-sql-test');
  again := public.submit_support_enquiry(saved,'feedback','','','','','Test feedback for the inbox.','/','support-sql-test');
  if again <> saved or (select count(*) from public.support_enquiries where sender_hash='support-sql-test') <> 1 then raise exception 'Duplicate request was not idempotent'; end if;
  for i in 1..4 loop
    perform public.submit_support_enquiry(gen_random_uuid(),'feedback','','','','','Another test feedback message.','/','support-sql-test');
  end loop;
  begin
    perform public.submit_support_enquiry(gen_random_uuid(),'feedback','','','','','This request should be rate limited.','/','support-sql-test');
    raise exception 'Rate limit was not enforced' using errcode='XX000';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Too many requests' then raise; end if;
  end;
end $$;
rollback;
