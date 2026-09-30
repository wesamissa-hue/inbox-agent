begin;

alter table public.conversations
  add column if not exists summary text;

commit;