-- ============================================================
-- Team Inbox + AI Agent  —  database schema
-- Run this in Supabase -> SQL Editor, top to bottom.
-- ============================================================

-- 1) Conversations: one row per chat/thread shown in the inbox
create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
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

-- 3) Row Level Security
--    DEMO NOTE: these policies are open (anon + authenticated) so the
--    starter runs instantly. For production, lock them down to signed-in
--    admins only — you already learned how in the "Login + RLS" task.
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "inbox rw conversations" on public.conversations;
create policy "inbox rw conversations" on public.conversations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "inbox rw messages" on public.messages;
create policy "inbox rw messages" on public.messages
  for all to anon, authenticated using (true) with check (true);

-- 4) Realtime: let the inbox update itself the moment a row changes
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
