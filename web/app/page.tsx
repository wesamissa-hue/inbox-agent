"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Composer from '../components/Composer'

type Conversation = {
  id: string
  contact: string
  channel: string
  status: string
  unread: number
  last_message: string | null
  updated_at: string
}

type Message = {
  id: string
  conversation_id: string
  role: 'user' | 'agent'
  body: string | null
  image_url: string | null
  created_at: string
}

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const activeIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
    setConversations((data as Conversation[]) || [])
    setLoading(false)
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    setMessages((data as Message[]) || [])
  }

  // Load once, then listen for realtime changes on both tables.
  useEffect(() => {
    loadConversations()
    const channel = supabase
      .channel('inbox-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        const id = activeIdRef.current
        if (id) loadMessages(id)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // When the selected conversation changes, load its messages.
  useEffect(() => {
    activeIdRef.current = activeId
    if (activeId) loadMessages(activeId)
    else setMessages([])
  }, [activeId])

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function seedDemo() {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ contact: 'Website visitor', channel: 'web', last_message: 'New chat' })
      .select()
      .single()
    console.log('seedDemo result:', { data, error })
    if (data) {
      await loadConversations()
      setActiveId((data as Conversation).id)
    }
  }

  const active = conversations.find((c) => c.id === activeId) || null

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Team Inbox</h1>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <button className="btn secondary" style={{ height: 36, padding: '0 12px' }} onClick={seedDemo}>
            + New demo chat
          </button>
        </div>
        <div className="convo-list">
          {loading && <div className="empty">Loading...</div>}
          {!loading && conversations.length === 0 && (
            <div className="empty">No conversations yet.<br />Click “+ New demo chat” to start.</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={'convo' + (c.id === activeId ? ' active' : '')}
              onClick={() => setActiveId(c.id)}
            >
              <div className="top">
                <span className="name">
                  {c.contact}
                  {c.status === 'needs_human' && <span className="need-human">NEED HUMAN</span>}
                </span>
                <span className="chan">{c.channel}</span>
              </div>
              <div className="preview">{c.last_message || 'No messages yet'}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="thread">
        {!active && <div className="empty">Pick a conversation to see the messages.</div>}
        {active && (
          <>
            <div className="thread-header">{active.contact} · <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{active.channel}</span></div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={'row ' + m.role}>
                  <div className={'bubble ' + m.role}>
                    <div className="who">{m.role === 'agent' ? 'Agent' : active.contact}</div>
                    {m.body}
                    {m.image_url && <img src={m.image_url} alt="attachment" />}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <Composer conversationId={active.id} />
          </>
        )}
      </main>
    </div>
  )
}
