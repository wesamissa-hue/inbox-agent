# How it all fits together

This is the same Inbox you already built — but now an AI **agent** answers inside
it, and it can **read images** too. No Telegram this time: the message comes from
the inbox and the reply goes right back to the inbox.

## The round trip

```
            (1) send text + optional image
  Inbox (Next.js)  ------------------------------>  Supabase
     ^   |                                          - messages (role='user')
     |   |  (2) POST { conversation_id }            - storage: inbox-images
     |   v
     |  n8n webhook  "inbox-agent"
     |   |
     |   |  (3) RPC get_conversation_context  -->  Supabase (reads thread + image)
     |   |
     |   |  (4) call the model (with vision)  -->  LLM (reads the image, writes a reply)
     |   |
     |   |  (5) RPC post_agent_reply          -->  Supabase (messages, role='agent')
     |   |
     |   +--(6) realtime pushes the new row ---->  Inbox shows the agent's reply live
```

## Why two database functions (the "role" we give the agent)

Instead of letting the agent poke at tables directly, we hand it **two clear
doors**:

- **`get_conversation_context(conversation_id)`** — the agent's *read* door. It
  returns the conversation plus the last 20 messages (including any image URL).
- **`post_agent_reply(conversation_id, body)`** — the agent's *write* door. It
  drops the reply into the thread and updates the preview in one safe step.

This is a tiny, honest contract: the agent can read a thread and post one reply.
Nothing more. That is exactly how you keep an agent both useful and safe.

## The pieces

| Piece | Folder | What it does |
| --- | --- | --- |
| Web inbox | `web/` | Next.js app: shows chats, sends messages + images, updates live |
| Database | `supabase/` | tables, the two RPC functions, image bucket |
| Agent | `n8n/` | reads context, calls the vision model, writes the reply back |
