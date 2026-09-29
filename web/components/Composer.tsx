"use client"

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!text.trim() && !file) return
    setSending(true)
    setError(null)
    try {
      // 1) If there is an image, upload it to Storage and get a public URL.
      let imageUrl: string | null = null
      if (file) {
        const path = conversationId + '/' + Date.now() + '-' + file.name
        const up = await supabase.storage.from('inbox-images').upload(path, file)
        if (up.error) throw up.error
        imageUrl = 'storage://' + path.split('/').map(encodeURIComponent).join('/')
      }

      // 2) Save the user's message.
      const ins = await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        body: text.trim() || null,
        image_url: imageUrl,
      })
      if (ins.error) throw ins.error

      // 3) Update the conversation preview.
      await supabase
        .from('conversations')
        .update({ last_message: text.trim() || '[image]', updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      // 4) Wake the agent in n8n. It will read the thread and reply back.
      const webhook = process.env.NEXT_PUBLIC_N8N_AGENT_WEBHOOK
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ conversation_id: conversationId }),
        })
      }

      setText('')
      setFile(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      setError(message)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="composer">
      {error && <div className="error-text">{error}</div>}
      <div className="attach">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
        />
        {file && <span className="chip">{file.name}</span>}
      </div>
      <div className="field-row">
        <textarea
          placeholder="Type a message as the customer, then press Enter..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn" onClick={send} disabled={sending}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
