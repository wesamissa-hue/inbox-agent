begin;

drop policy if exists conversations_delete_owner on public.conversations;

create policy conversations_delete_owner
  on public.conversations for delete to authenticated
  using (user_id = (select auth.uid()));

grant delete on table public.conversations to authenticated;

commit;