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
3. **Web app** — `cd web`, copy `.env.local.example` to `.env.local`, fill in
   your Supabase URL + anon key and the n8n webhook URL, then:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000, click “+ New demo chat”, send a message or an
   image, and watch the agent reply on its own.
4. **Deploy** — push `web/` to GitHub, import into Vercel, add the three
   `NEXT_PUBLIC_` env vars, deploy.

## Versions (all current, so nothing conflicts)

- Next.js `^16.3.6`
- React / React DOM `^19.0.0`
- @supabase/supabase-js `^2.116.0`
- Node.js `20.9+` required

Full walkthrough with pictures-in-words is in **the guide PDF**.
