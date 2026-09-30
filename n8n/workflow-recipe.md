# The agent workflow, node by node

Import `inbox-agent.n8n.json` into n8n (Workflows -> ... -> Import from File).
Here is what each node does, in plain language.

1. **Inbox Webhook** — the door the inbox knocks on. It receives
   `{ "conversation_id": "..." }` when someone sends a message.

2. **Get Conversation Context** — calls your database function
   `get_conversation_context`. This is the agent's *read* door: it gets the
   conversation plus the last 20 messages, including any image URL.

3. **Sign Private Images** — the HTTP Request node batches image object paths
   through Supabase Storage and places the short-lived signed URLs in the
   `signed_images` output field. It uses the existing n8n `SUPABASE_URL` and
   `SUPABASE_SERVICE_KEY` variables; the service key never reaches the browser.

4. **Build Prompt** — turns the conversation and signing response into an
   OpenAI-style chat request. Signed image URLs are added as `image_url` parts
   so the model can **see** the images.

5. **Call Model (with vision)** — sends the request to your AI provider and
   gets an answer back. Works with any OpenAI-style endpoint.

6. **Extract Reply** — pulls the reply text out of the response.

7. **Post Reply To Inbox** — calls your database function `post_agent_reply`.
   This is the agent's *write* door: it drops the answer into the thread.

8. **Respond OK** — tells the inbox “got it.” The reply itself appears in the
   inbox on its own, thanks to realtime.

## Environment variables to set in n8n

Settings -> Environments (or your `.env` for self-hosted). None of these go in
the code — keep secrets out of the workflow.

| Variable | Example | What it is |
| --- | --- | --- |
| `SUPABASE_URL` | `https://YOUR-ref.supabase.co` | Your project URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | The **service_role** key (server-side only!) |
| `LLM_API_URL` | `https://api.openai.com/v1/chat/completions` | Any OpenAI-style endpoint |
| `LLM_API_KEY` | `sk-...` | Your model provider key |
| `LLM_MODEL` | `gpt-4o-mini` | A **vision-capable** model |

## Separate post-reply conversation summary

After `Post Reply To Inbox`, the workflow responds to the inbox first, then
runs a separate summary branch. It summarizes the recent conversation history
plus the new agent reply, validates a one- or two-sentence result, and patches
only `conversations.summary`, filtered by both conversation ID and owner ID.
Summary failures do not change or delay the customer reply. It reuses the
existing LLM and server-side Supabase environment variables; no new credentials
are needed. Apply `supabase/migrations/20260930_conversation_summary.sql`
manually before expecting summaries to save.

## Two ways to trigger it

- **This kit:** the inbox POSTs to the webhook right after saving a message.
  Simple and easy to see.
- **Fully hands-off (bonus):** add a Supabase *Database Webhook* on new rows in
  `messages` (where `role = 'user'`) that calls this same webhook. Then even
  messages from other channels trigger the agent.
