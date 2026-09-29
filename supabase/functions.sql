-- ============================================================
-- The database "role" you hand to the agent: two functions (RPCs)
--   * get_conversation_context  -> the agent READS the thread + image
--   * post_agent_reply          -> the agent WRITES its answer back
-- Run this AFTER schema.sql.
-- ============================================================

-- READ: give the agent everything it needs about one conversation:
-- the conversation row plus the last 20 messages (oldest -> newest).
create or replace function public.get_conversation_context(p_conversation_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'conversation', (
      select to_jsonb(c) from public.conversations c where c.id = p_conversation_id
    ),
    'messages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
      from (
        select role, body, image_url, created_at
        from public.messages
        where conversation_id = p_conversation_id
        order by created_at desc
        limit 20
      ) x
    )
  );
$$;

-- WRITE: the agent posts its reply back into the inbox in one safe step
-- (insert the message + update the conversation summary together).
create or replace function public.post_agent_reply(p_conversation_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.messages (conversation_id, role, body)
  values (p_conversation_id, 'agent', p_body)
  returning id into new_id;

  update public.conversations
     set last_message = p_body,
         updated_at   = now()
   where id = p_conversation_id;

  return jsonb_build_object('ok', true, 'message_id', new_id);
end;
$$;

-- Who is allowed to call these. The agent uses the service_role key.
revoke all on function public.get_conversation_context(uuid) from public, anon, authenticated;
revoke all on function public.post_agent_reply(uuid, text) from public, anon, authenticated;
grant execute on function public.get_conversation_context(uuid) to service_role;
grant execute on function public.post_agent_reply(uuid, text) to service_role;
