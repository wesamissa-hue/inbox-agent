# Definition of done

Tick these off in order. If one fails, fix it before moving on.

## Database
- [ ] Ran `supabase/schema.sql` (tables + RLS + realtime)
- [ ] Ran `supabase/functions.sql` (get_conversation_context + post_agent_reply)
- [ ] Ran `supabase/storage.sql` (inbox-images bucket)

## Web app
- [ ] Copied `web/.env.local.example` to `web/.env.local` and filled it in
- [ ] `npm install` then `npm run dev` — inbox opens at http://localhost:3000
- [ ] “+ New demo chat” creates a conversation

## Agent (n8n)
- [ ] Imported `n8n/inbox-agent.n8n.json`
- [ ] Set the environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, LLM_API_URL, LLM_API_KEY, LLM_MODEL)
- [ ] Activated the workflow and copied its webhook URL into `NEXT_PUBLIC_N8N_AGENT_WEBHOOK`

## The magic moment
- [ ] Send a text message in the inbox → the agent replies within a few seconds
- [ ] Send an image (e.g. a photo of a product or a screenshot) → the agent describes/answers using the image
- [ ] The reply appears **by itself**, without refreshing the page (realtime)

## Deploy
- [ ] Pushed `web/` to GitHub and imported it into Vercel
- [ ] Added the three NEXT_PUBLIC_ env vars in Vercel
- [ ] Live URL works the same as local
