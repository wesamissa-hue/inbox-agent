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

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- 3) Row Level Security
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages      enable row level security;
alter table public.messages      force row level security;

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

-- 4) Realtime: let the inbox update itself the moment a row changes
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
