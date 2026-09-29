-- Scope private conversations, messages, and image objects to Supabase Auth users.
-- Existing conversations are deliberately left unowned until an operator maps them.
-- Those rows become invisible to anon/authenticated users immediately.

begin;

alter table public.conversations
  add column if not exists user_id uuid;

alter table public.conversations
  alter column user_id set default auth.uid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_user_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_user_id_not_null'
  ) then
    alter table public.conversations
      add constraint conversations_user_id_not_null
      check (user_id is not null) not valid;
  end if;
end;
$$;

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- Old public image URLs are converted to object paths before the bucket is private.
update public.messages
set image_url = 'storage://' || regexp_replace(
    image_url,
    '^https?://[^/]+/storage/v1/object/public/inbox-images/',
    ''
  )
where image_url ~ '^https?://[^/]+/storage/v1/object/public/inbox-images/';

update storage.buckets
set public = false
where id = 'inbox-images';

alter table storage.objects enable row level security;

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;

-- Replace every prior policy on these two tables so no permissive policy can OR
-- around the owner checks below.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'messages')
  loop
    execute format('drop policy %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end;
$$;

create policy conversations_select_owner
  on public.conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy conversations_insert_owner
  on public.conversations for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy conversations_update_owner
  on public.conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy messages_select_owner_conversation
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = (select auth.uid())
  ));

create policy messages_insert_owner_conversation
  on public.messages for insert to authenticated
  with check (
    role = 'user'
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

revoke all on table public.conversations, public.messages from public, anon;
grant select, insert, update on table public.conversations to authenticated;
grant select, insert on table public.messages to authenticated;

-- Images are stored under <conversation UUID>/<filename>.
drop policy if exists "inbox images read" on storage.objects;
drop policy if exists "inbox images upload" on storage.objects;
drop policy if exists "inbox images select owner" on storage.objects;
drop policy if exists "inbox images insert owner" on storage.objects;

create policy "inbox images select owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inbox-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = (select auth.uid())
    )
  );

create policy "inbox images insert owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inbox-images'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = (select auth.uid())
    )
  );

-- n8n calls these RPCs with its server-side service_role key. Do not expose
-- SECURITY DEFINER RPCs to browser or anonymous clients.
revoke all on function public.get_conversation_context(uuid) from public, anon, authenticated;
revoke all on function public.post_agent_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.get_conversation_context(uuid) to service_role;
grant execute on function public.post_agent_reply(uuid, text) to service_role;

commit;

-- After manually assigning each existing conversation to its verified owner,
-- validate the staged constraints and make ownership mandatory:
--
-- alter table public.conversations validate constraint conversations_user_id_fkey;
-- alter table public.conversations validate constraint conversations_user_id_not_null;
-- alter table public.conversations alter column user_id set not null;
