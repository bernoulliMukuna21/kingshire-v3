-- Organisation workspaces are owned by authenticated people. A shared
-- contact address can be collected later when a feature actually needs it.
alter table public.organisations
  alter column email drop not null;
