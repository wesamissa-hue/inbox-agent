"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import Composer from '../components/Composer'
import { displayNameFromEmail, initialsFromName } from '../lib/userIdentity'

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

function getImageObjectPath(value: string) {
  const storagePrefix = 'storage://'
  const markers = [
    '/storage/v1/object/public/inbox-images/',
    '/storage/v1/object/sign/inbox-images/',
  ]
  const marker = markers.find((candidate) => value.includes(candidate))
  const storedPath = value.startsWith(storagePrefix)
    ? value.slice(storagePrefix.length).split('?')[0]
    : marker
      ? value.slice(value.indexOf(marker) + marker.length).split('?')[0]
    : value.startsWith('http')
      ? null
      : value

  if (!storedPath) return null
  try {
    return decodeURIComponent(storedPath)
  } catch {
    return storedPath
  }
}

function displayContactName(contact: string, currentUserName: string) {
  return contact === 'Website visitor' || !contact ? currentUserName : contact
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function Page() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const activeIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  async function loadConversations(ownerId: string) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', ownerId)
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
    const messages = (data as Message[]) || []
    const messagesWithSignedImages = await Promise.all(messages.map(async (message) => {
      if (!message.image_url) return message
      const path = getImageObjectPath(message.image_url)
      if (!path) return { ...message, image_url: null }
      const { data: signedImage, error } = await supabase.storage
        .from('inbox-images')
        .createSignedUrl(path, 60 * 60)
      return { ...message, image_url: error ? null : signedImage.signedUrl }
    }))
    setMessages(messagesWithSignedImages)
  }

  // Load once, then listen for realtime changes on both tables.
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function initializeInbox() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (cancelled) return
      if (error || !user) {
        setLoading(false)
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? null)
      await loadConversations(user.id)
      if (cancelled) return

      channel = supabase
        .channel('inbox-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, () => {
          loadConversations(user.id)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          const id = activeIdRef.current
          if (id) loadMessages(id)
        })
        .subscribe()
    }

    void initializeInbox()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
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
    if (!userId) return
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, contact: 'Website visitor', channel: 'web', last_message: 'New chat' })
      .select()
      .single()
    console.log('seedDemo result:', { data, error })
    if (data) {
      await loadConversations(userId)
      setActiveId((data as Conversation).id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const active = conversations.find((c) => c.id === activeId) || null
  const currentUserName = displayNameFromEmail(userEmail)
  const activeDisplayName = active ? displayContactName(active.contact, currentUserName) : currentUserName
  const activeIsCurrentUser = active?.contact === 'Website visitor' || !active?.contact

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Team Inbox</h1>
          <span>AI SUPPORT DESK</span>
        </div>
        <nav className="dashboard-nav" aria-label="Workspace navigation">
          <Link href="/agent-dashboard"><span className="nav-link-label"><span className="nav-icon" aria-hidden="true">↗</span>Agent dashboard</span><span className="nav-arrow" aria-hidden="true">→</span></Link>
        </nav>
        <div className="sidebar-actions">
          <button className="btn secondary" onClick={seedDemo} disabled={!userId}>
            <span aria-hidden="true">+</span> New demo chat
          </button>
        </div>
        <div className="convo-list-heading"><span>Conversations</span><span>{conversations.length}</span></div>
        <div className="convo-list" role="group" aria-label="Conversations">
          {loading && (
            <div className="conversation-skeletons" role="status" aria-label="Loading conversations">
              {[0, 1, 2].map((item) => <div className="conversation-skeleton" key={item}><span /><div><i /><i /></div></div>)}
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="empty conversation-empty">No conversations yet.<br />Use “New demo chat” to start.</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={'convo' + (c.id === activeId ? ' active' : '')}
              role="button"
              tabIndex={0}
              aria-pressed={c.id === activeId}
              onClick={() => setActiveId(c.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveId(c.id)
                }
              }}
            >
              <div className="top">
                <span className="avatar convo-avatar" aria-hidden="true">{initialsFromName(displayContactName(c.contact, currentUserName))}</span>
                <span className="convo-copy">
                  <span className="convo-title-row">
                    <span className="name">{displayContactName(c.contact, currentUserName)}</span>
                    {c.status === 'needs_human' && <span className="need-human">NEED HUMAN</span>}
                  </span>
                  <span className="convo-details">
                    <span className="preview">{c.last_message || 'No messages yet'}</span>
                    <time className="convo-time" dateTime={c.updated_at}>{formatTime(c.updated_at)}</time>
                  </span>
                </span>
                <span className="chan">{c.channel}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-account">
          <span className="avatar account-avatar" aria-hidden="true">{initialsFromName(currentUserName)}</span>
          <span className="account-copy"><strong>{currentUserName}</strong><span>{userEmail || 'Signed-in user'}</span></span>
          <button className="sign-out" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="thread">
        {!active && (
          <div className="empty thread-empty">
            <span className="empty-icon" aria-hidden="true"><span /></span>
            <h2>Select a conversation</h2>
            <p>Choose a conversation from your inbox to view messages and reply.</p>
          </div>
        )}
        {active && (
          <>
            <div className="thread-header">
              <span className="avatar thread-avatar" aria-hidden="true">{initialsFromName(activeDisplayName)}</span>
              <div className="thread-identity">
                <div className="thread-title">{activeDisplayName}<span className="thread-channel">{active.channel}</span></div>
                <div className="thread-email">{activeIsCurrentUser && userEmail ? userEmail : 'Customer conversation'}</div>
              </div>
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={'row ' + m.role}>
                  <div className={'bubble ' + m.role}>
                    <div className="bubble-meta">
                      <div className="who">{m.role === 'agent' ? <><span className="agent-mark" aria-hidden="true">AI</span> Agent</> : activeDisplayName}</div>
                      <time className="message-time" dateTime={m.created_at}>{formatTime(m.created_at)}</time>
                    </div>
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
