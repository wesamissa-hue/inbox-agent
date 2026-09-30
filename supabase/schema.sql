-- ============================================================
-- Team Inbox + AI Agent  —  database schema
-- Run this in Supabase -> SQL Editor, top to bottom.
-- ============================================================

-- 1) Conversations: one row per chat/thread shown in the inbox
create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact      text not null default 'Guest',
  channel      text not null default 'web',
  status       text not null default 'open',
  is_pinned    boolean not null default false,
  unread       integer not null default 0,
  last_message text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- 2) Messages: every message in a conversation, from the user OR the agent
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'agent')),
  body            text,
  image_url       text,
  created_at      timestamptz not null default now()
);

-- 3) Private notes: kept separate from customer-visible messages.
create table if not exists public.conversation_notes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists conversation_notes_owner_thread_created_idx
  on public.conversation_notes (user_id, conversation_id, created_at desc);
create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists conversations_user_pinned_updated_idx
  on public.conversations (user_id, is_pinned desc, updated_at desc);

-- 3) Row Level Security
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages      enable row level security;
alter table public.messages      force row level security;
alter table public.conversation_notes enable row level security;
alter table public.conversation_notes force row level security;

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

drop policy if exists conversation_notes_select_owner on public.conversation_notes;
drop policy if exists conversation_notes_insert_owner on public.conversation_notes;
drop policy if exists conversation_notes_update_owner on public.conversation_notes;
drop policy if exists conversation_notes_delete_owner on public.conversation_notes;

create policy conversation_notes_select_owner
  on public.conversation_notes for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy conversation_notes_insert_owner
  on public.conversation_notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy conversation_notes_update_owner
  on public.conversation_notes for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy conversation_notes_delete_owner
  on public.conversation_notes for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

revoke all on table public.conversations, public.messages from public, anon;
revoke all on table public.conversation_notes from public, anon, service_role;
grant select, insert, update on table public.conversations to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update, delete on table public.conversation_notes to authenticated;

-- 4) Realtime: let the inbox update itself the moment a row changes
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
