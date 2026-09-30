# Team Inbox + AI Agent (reads text & images)

The Inbox you already built — but now an AI **agent answers inside it**, and it
can **read images**. The message comes from the inbox, and the reply goes back
to the inbox (no Telegram this time).

## What is in the box

```
inbox-agent/
  web/            Next.js inbox app (deploy to Vercel)
  supabase/       schema.sql, functions.sql, storage.sql
  n8n/            inbox-agent.n8n.json + workflow-recipe.md
  ARCHITECTURE.md the round trip, explained with a diagram
  CHECKLIST.md    definition of done
```

## Quick start (about 20 minutes)

1. **Database** — for a fresh project, run `supabase/schema.sql`, then
   `supabase/functions.sql`, then `supabase/storage.sql`. For an existing
   project, back it up and apply
   `supabase/migrations/20260929_user_conversation_isolation.sql` instead of
   rerunning the fresh-install schema. Follow the ownership backfill steps
   below before making `user_id` non-null, then apply
   `supabase/migrations/20260930_pro_inbox_workspace.sql`. Apply
   `supabase/migrations/20260930_conversation_summary.sql` manually to add the
   display-only summary column; the app and workflow never run migrations.
2. **Agent** — update the existing workflow with the **Sign Private Images**
   HTTP Request node and revised **Build Prompt** node from
   `n8n/inbox-agent.n8n.json`. Keep its webhook URL and downstream model/reply
   nodes. Set the environment variables described in `n8n/workflow-recipe.md`
   and activate the workflow.
3. **Web app** — configure `web/.env.local` with the values for
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_N8N_AGENT_WEBHOOK`, and `SUPABASE_SERVICE_KEY`, then:
   ```
   cd web
   npm install
   npm run dev
   ```
   Open http://localhost:3000, create an account or sign in, click “New chat”,
   send a message or an image, and watch the agent reply on its own.
4. **Deploy** — push `web/` to GitHub, import into Vercel, add the three
   `NEXT_PUBLIC_` variables and the server-only `SUPABASE_SERVICE_KEY`, then
   deploy. Set the Supabase Auth Site URL to the deployed app URL.

## Authentication and environment

Email/password sign-up and sign-in use the existing Supabase Auth project.
Email confirmation follows that project's Auth settings; when enabled, users
must confirm their address before signing in. Conversations are owned by the
creating user's Auth ID. RLS scopes conversations, their messages, and private
image objects to that owner. The n8n agent remains a trusted server-side actor;
its RPC grants use `service_role`, and its prompt step creates short-lived image
URLs from private object paths.

The Agent Dashboard uses a server-only service-role key and is restricted to
users whose trusted `app_metadata.role` is `admin`. Set that claim only for
trusted operators. For example, in the Supabase SQL Editor, replace the UUID
with the intended Auth user's ID:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
   || '{"role":"admin"}'::jsonb
where id = '<trusted-admin-user-uuid>';
```

Never prefix `SUPABASE_SERVICE_KEY` with `NEXT_PUBLIC_` or place it in
client-side code. Keep local values in the ignored `web/.env.local` and
deployment values in Vercel's server-side environment settings.

### Pro Inbox Workspace

The inbox includes a user/browser-scoped accent preference, pinned
conversations, deterministic priority labels, and private notes stored apart
from customer messages. Fresh installs receive these objects from
`supabase/schema.sql`; existing installs apply the additive Pro Inbox migration
after conversation ownership has been migrated and backfilled. Note RLS checks
both the authenticated note owner and the owner of its conversation. Notes are
not included in messages or the agent conversation-context RPC.

### Existing Conversation Backfill

The migration does not guess who owns existing chats. Unassigned rows become
invisible to normal users immediately. Review them in the SQL Editor and assign
each one to its verified Auth owner before validating the staged constraints:

```sql
select id, contact, created_at
from public.conversations
where user_id is null;

update public.conversations
set user_id = '<verified-auth-user-uuid>'
where id in ('<conversation-uuid-1>', '<conversation-uuid-2>');

alter table public.conversations validate constraint conversations_user_id_fkey;
alter table public.conversations validate constraint conversations_user_id_not_null;
alter table public.conversations alter column user_id set not null;
```

Repeat the `UPDATE` for each verified owner. Do not assign all historical rows
to the first account unless that is the correct owner for every row. The
migration also makes `inbox-images` private and converts existing bucket URLs
to object paths; deploy the matching app and n8n changes after applying it.

## Versions (all current, so nothing conflicts)

- Next.js `^16.3.6`
- React / React DOM `^19.0.0`
- @supabase/ssr `^0.12.7`
- @supabase/supabase-js `^2.116.0`
- Node.js `20.9+` required

Full walkthrough with pictures-in-words is in **the guide PDF**.
