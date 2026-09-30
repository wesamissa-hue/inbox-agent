begin;

alter table public.conversations
  add column if not exists is_pinned boolean not null default false;

create index if not exists conversations_user_pinned_updated_idx
  on public.conversations (user_id, is_pinned desc, updated_at desc);

create table if not exists public.conversation_notes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists conversation_notes_owner_thread_created_idx
  on public.conversation_notes (user_id, conversation_id, created_at desc);

alter table public.conversation_notes enable row level security;
alter table public.conversation_notes force row level security;

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

revoke all on table public.conversation_notes from public, anon, service_role;
grant select, insert, update, delete on table public.conversation_notes to authenticated;

commit;