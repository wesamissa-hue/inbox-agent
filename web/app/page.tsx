"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import Composer from '../components/Composer'
import AppearanceControl from '../components/AppearanceControl'
import ConversationNotes from '../components/ConversationNotes'
import ConversationActions from '../components/ConversationActions'
import DeleteConversationDialog from '../components/DeleteConversationDialog'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useLanguage } from '../components/LanguageProvider'
import { displayNameFromEmail, initialsFromName } from '../lib/userIdentity'
import { getConversationPriority } from '../lib/conversationPriority'

type Conversation = {
  id: string
  contact: string
  channel: string
  status: string
  is_pinned: boolean
  unread: number
  last_message: string | null
  summary?: string | null
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

function displayContactName(contact: string, currentUserName: string, visitorLabel: string) {
  return contact === 'Website visitor' || !contact ? visitorLabel : contact
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export default function Page() {
  const router = useRouter()
  const { direction, t } = useLanguage()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [noteConversationIds, setNoteConversationIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const messageRequestRef = useRef(0)
  const noteIndicatorRequestRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  async function loadNoteIndicators(ownerId: string, conversationIds: string[]) {
    const requestId = ++noteIndicatorRequestRef.current
    if (conversationIds.length === 0) {
      setNoteConversationIds(new Set())
      return
    }
    try {
      const { data, error } = await supabase
        .from('conversation_notes')
        .select('conversation_id')
        .eq('user_id', ownerId)
        .in('conversation_id', conversationIds)
      if (error) throw error
      if (requestId === noteIndicatorRequestRef.current) {
        setNoteConversationIds(new Set((data || []).map((note) => note.conversation_id)))
      }
    } catch {
      if (requestId === noteIndicatorRequestRef.current) setNoteConversationIds(new Set())
    }
  }

  async function loadConversations(ownerId: string) {
    setConversationsError(null)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', ownerId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      const loadedConversations = (data as Conversation[]) || []
      setConversations(loadedConversations)
      void loadNoteIndicators(ownerId, loadedConversations.map((conversation) => conversation.id))
    } catch {
      setConversationsError(t('conversationsLoadError'))
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(conversationId: string) {
    const requestId = ++messageRequestRef.current
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (requestId !== messageRequestRef.current) return
      if (error) throw error

      const messages = (data as Message[]) || []
      const messagesWithSignedImages = await Promise.all(messages.map(async (message) => {
        if (!message.image_url) return message
        const path = getImageObjectPath(message.image_url)
        if (!path) return { ...message, image_url: null }
        const { data: signedImage, error: signingError } = await supabase.storage
          .from('inbox-images')
          .createSignedUrl(path, 60 * 60)
        return { ...message, image_url: signingError ? null : signedImage.signedUrl }
      }))
      if (requestId !== messageRequestRef.current) return
      setMessages(messagesWithSignedImages)
    } catch {
      if (requestId !== messageRequestRef.current) return
      setMessages([])
      setMessagesError(t('messagesLoadError'))
    } finally {
      if (requestId === messageRequestRef.current) setMessagesLoading(false)
    }
  }

  // Load once, then listen for realtime changes on both tables.
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function initializeInbox() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (cancelled) return
        if (error) throw error
        if (!user) {
          setLoading(false)
          return
        }

        setUserId(user.id)
        setUserEmail(user.email ?? null)
        setIsAdmin(user.app_metadata?.role === 'admin')
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
      } catch {
        if (cancelled) return
        setConversationsError(t('conversationsLoadError'))
        setLoading(false)
      }
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
    setMessages([])
    setMessagesError(null)
    if (activeId) void loadMessages(activeId)
    else {
      messageRequestRef.current += 1
      setMessagesLoading(false)
    }
  }, [activeId])

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function seedDemo() {
    if (creatingDemo) return
    setCreatingDemo(true)
    setDemoError(null)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setDemoError(t('demoAuthError'))
        router.replace('/login')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? null)
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, contact: 'Website visitor', channel: 'web', last_message: 'New chat' })
        .select()
        .single()
      if (error || !data) {
        setDemoError(t('demoCreateError'))
        return
      }

      const conversation = data as Conversation
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)])
      setActiveId(conversation.id)
      await loadConversations(user.id)
    } catch {
      setDemoError(t('demoConnectionError'))
    } finally {
      setCreatingDemo(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  function updateNoteIndicator(conversationId: string, hasNotes: boolean) {
    noteIndicatorRequestRef.current += 1
    setNoteConversationIds((current) => {
      if (current.has(conversationId) === hasNotes) return current
      const next = new Set(current)
      if (hasNotes) next.add(conversationId)
      else next.delete(conversationId)
      return next
    })
  }

  const actionLabels = { actions: t('actions'), pin: t('pin'), unpin: t('unpin'), delete: t('delete') }

  async function togglePin(conversation: Conversation) {
    if (!userId || pinningId || deletingId) return
    setPinningId(conversation.id)
    setPinError(null)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ is_pinned: !conversation.is_pinned })
        .eq('id', conversation.id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle()
      if (error || !data) {
        setPinError(t('pinUpdateError'))
      } else {
        await loadConversations(userId)
      }
    } catch {
      setPinError(t('pinConnectionError'))
    } finally {
      setPinningId(null)
    }
  }

  async function deleteConversation() {
    if (!deleteTarget || deletingId) return
    setDeletingId(deleteTarget.id)
    setDeleteError(null)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || user.id !== userId) throw new Error(t('deleteSessionError'))
      const { data, error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle()
      if (error || !data) throw new Error(t('deleteConversationError'))

      const remaining = conversations.filter((conversation) => conversation.id !== deleteTarget.id)
      setConversations(remaining)
      if (activeId === deleteTarget.id) setActiveId(remaining[0]?.id ?? null)
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('deleteConversationError'))
    } finally {
      setDeletingId(null)
    }
  }

  const active = conversations.find((c) => c.id === activeId) || null
  const visibleConversations = conversations.filter((conversation) => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return true
    return [conversation.contact, conversation.last_message, conversation.channel]
      .some((value) => value?.toLocaleLowerCase().includes(query))
  })
  const currentUserName = displayNameFromEmail(userEmail)
  const activeDisplayName = active ? displayContactName(active.contact, currentUserName, t('websiteVisitor')) : currentUserName
  const activeIsCurrentUser = active?.contact === 'Website visitor' || !active?.contact

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1><img className="brand-mark" src="/icon.png" alt="" width="29" height="29" />{t('brand')}</h1>
          <span>{t('aiSupportDesk')}</span>
        </div>
        {isAdmin && (
          <nav className="dashboard-nav" aria-label="Workspace navigation">
            <Link href="/agent-dashboard"><span className="nav-link-label"><span className="nav-icon" aria-hidden="true">↗</span>{t('agentDashboard')}</span><span className="nav-arrow" aria-hidden="true">→</span></Link>
          </nav>
        )}
        <div className="sidebar-actions">
          <button className="btn secondary" onClick={seedDemo} disabled={!userId || creatingDemo}>
            <span aria-hidden="true">+</span> {creatingDemo ? t('creating') : t('newChat')}
          </button>
          {demoError && <div className="sidebar-action-error" role="alert">{demoError}</div>}
        </div>
        <label className="conversation-search">
          <span className="search-icon" aria-hidden="true" />
          <input type="search" placeholder={t('search')} value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="convo-list-heading"><span>{t('conversations')}</span><span>{conversations.length}</span></div>
        <div className="convo-list" role="group" aria-label={t('conversations')}>
          {conversationsError && (
            <div className="conversations-error" role="alert">
              <span>{t('conversationsLoadError')}</span>
              {userId && <button type="button" onClick={() => void loadConversations(userId)}>{t('retry')}</button>}
            </div>
          )}
          {loading && (
              <div className="conversation-skeletons" role="status" aria-label={t('loadingConversations')}>
              {[0, 1, 2].map((item) => <div className="conversation-skeleton" key={item}><span /><div><i /><i /></div></div>)}
            </div>
          )}
          {!loading && !conversationsError && conversations.length === 0 && (
              <div className="empty conversation-empty">{t('noConversations')}<br />{t('startChat')}</div>
          )}
          {!loading && !conversationsError && conversations.length > 0 && visibleConversations.length === 0 && (
            <div className="empty conversation-empty">{t('noSearchResults')}</div>
          )}
          {visibleConversations.map((c) => (
            <div
              key={c.id}
              className={'convo' + (c.id === activeId ? ' active' : '')}
              role="button"
              tabIndex={0}
              aria-pressed={c.id === activeId}
              onClick={() => setActiveId(c.id)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setActiveId(c.id)
                }
              }}
            >
              <div className="top">
                <span className="avatar convo-avatar" aria-hidden="true">{initialsFromName(displayContactName(c.contact, currentUserName, t('websiteVisitor')))}</span>
                <span className="convo-copy">
                  <span className="convo-title-row">
                    <span className="name">{displayContactName(c.contact, currentUserName, t('websiteVisitor'))}</span>
                    {noteConversationIds.has(c.id) && <span className="note-indicator" role="img" aria-label={t('hasInternalNote')} title={t('hasInternalNote')}><span aria-hidden="true" /></span>}
                    {c.is_pinned && <span className="pin-indicator" aria-label={t('pinned')}><span className="pin-icon" aria-hidden="true" /></span>}
                  </span>
                  <span className={`convo-priority priority-${getConversationPriority(c).toLowerCase()}`}>{t(getConversationPriority(c).toLowerCase() as 'high' | 'medium' | 'low')}</span>
                  <span className="convo-details">
                    <span className="preview">{c.last_message || t('noMessages')}</span>
                    <time className="convo-time" dateTime={c.updated_at}>{formatTime(c.updated_at)}</time>
                  </span>
                </span>
                <span className="convo-end-meta"><ConversationActions isPinned={c.is_pinned} direction={direction} labels={actionLabels} disabled={pinningId === c.id || deletingId === c.id} onPin={() => void togglePin(c)} onDelete={() => { setDeleteTarget(c); setDeleteError(null) }} /></span>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-account">
          <span className="avatar account-avatar" aria-hidden="true">{initialsFromName(currentUserName)}</span>
          <span className="account-copy"><strong>{currentUserName}</strong><span>{userEmail || 'Signed-in user'}</span></span>
          <LanguageSwitcher />
          <AppearanceControl />
          <button className="sign-out" onClick={signOut}>{t('signOut')}</button>
        </div>
      </aside>

      <main className="thread">
        {!active && (
          <div className="empty thread-empty">
            <span className="empty-icon" aria-hidden="true"><span /></span>
            <h2>{t('selectConversation')}</h2>
            <p>{t('selectConversationHelp')}</p>
          </div>
        )}
        {active && (
          <>
            <div className="thread-header">
              <span className="avatar thread-avatar" aria-hidden="true">{initialsFromName(activeDisplayName)}</span>
              <div className="thread-identity">
                <div className="thread-title">{activeDisplayName}</div>
                <div className="thread-subtitle">
                  {active.status === 'open' && <span className="thread-status">{t('openStatus')}</span>}
                  <span className="thread-email">{activeIsCurrentUser && userEmail ? userEmail : t('customerConversation')}</span>
                  <span className={`priority-badge priority-${getConversationPriority(active).toLowerCase()}`}>{t(getConversationPriority(active).toLowerCase() as 'high' | 'medium' | 'low')} · {t('priority')}</span>
                </div>
                {active.summary?.trim() && <p className="thread-summary" dir="auto"><span>{t('conversationSummary')}</span>{active.summary.trim()}</p>}
              </div>
              <ConversationActions isPinned={active.is_pinned} direction={direction} labels={actionLabels} disabled={pinningId === active.id || deletingId === active.id} onPin={() => void togglePin(active)} onDelete={() => { setDeleteTarget(active); setDeleteError(null) }} />
            </div>
            {pinError && <div className="error-text thread-action-error" role="alert">{pinError}</div>}
            {userId && (
              <div className="conversation-panels">
                <details className="workspace-panel">
                  <summary><span>{t('notes')}</span><span className="workspace-panel-tag">{t('private')}</span></summary>
                  <ConversationNotes key={active.id} conversationId={active.id} userId={userId} author={currentUserName} onNotesExistChange={(hasNotes) => updateNoteIndicator(active.id, hasNotes)} />
                </details>
              </div>
            )}
            <div className="messages">
              {messagesLoading && messages.length === 0 && <div className="message-state" role="status">{t('loadingMessages')}</div>}
              {messagesError && <div className="message-state message-state-error" role="alert"><span>{t('messagesLoadError')}</span><button type="button" onClick={() => void loadMessages(active.id)}>{t('retry')}</button></div>}
              {!messagesLoading && !messagesError && messages.length === 0 && <div className="message-state">{t('noMessages')}</div>}
              {messages.map((m) => (
                <div key={m.id} className={'row ' + m.role}>
                  <div className={'bubble ' + m.role} dir="auto">
                    <div className="bubble-meta">
                      <div className="who">{m.role === 'agent' ? <><span className="agent-mark" aria-hidden="true">AI</span> {t('agent')}</> : activeDisplayName}</div>
                      <time className="message-time" dateTime={m.created_at}>{formatTime(m.created_at)}</time>
                    </div>
                    {m.body}
                    {m.image_url && <img src={m.image_url} alt="attachment" />}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <Composer key={active.id} conversationId={active.id} />
          </>
        )}
      </main>
      <DeleteConversationDialog
        open={Boolean(deleteTarget)}
        deleting={Boolean(deleteTarget && deletingId === deleteTarget.id)}
        error={deleteError}
        title={t('deleteConversationTitle')}
        description={t('deleteConversationDescription')}
        cancelLabel={t('cancel')}
        deleteLabel={t('delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteConversation()}
      />
    </div>
  )
}
