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

1. **Database** — in Supabase SQL Editor, run `supabase/schema.sql`, then
   `supabase/functions.sql`, then `supabase/storage.sql`.
2. **Agent** — import `n8n/inbox-agent.n8n.json`, set the environment variables
   (see `n8n/workflow-recipe.md`), activate it, and copy its webhook URL.
3. **Web app** — configure `web/.env.local` with the values for
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_N8N_AGENT_WEBHOOK`, and `SUPABASE_SERVICE_KEY`, then:
   ```
   cd web
   npm install
   npm run dev
   ```
   Open http://localhost:3000, create an account or sign in, click “+ New demo
   chat”, send a message or an image, and watch the agent reply on its own.
4. **Deploy** — push `web/` to GitHub, import into Vercel, add the three
   `NEXT_PUBLIC_` variables and the server-only `SUPABASE_SERVICE_KEY`, then
   deploy. Set the Supabase Auth Site URL to the deployed app URL.

## Authentication and environment

Email/password sign-up and sign-in use the existing Supabase Auth project.
Email confirmation follows that project's Auth settings; when enabled, users
must confirm their address before signing in. The service-role key is used only
by the server-side dashboard data helper. Never prefix it with `NEXT_PUBLIC_` or
place it in client-side code.

The supplied database policies are intentionally open for this demo and allow
both `anon` and `authenticated` access. Creating an account does not provide
per-user conversation isolation; tighten the policies and add team ownership
before using real customer data.

## Versions (all current, so nothing conflicts)

- Next.js `^16.3.6`
- React / React DOM `^19.0.0`
- @supabase/ssr `^0.12.7`
- @supabase/supabase-js `^2.116.0`
- Node.js `20.9+` required

Full walkthrough with pictures-in-words is in **the guide PDF**.
