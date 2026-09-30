"use client"

import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from './LanguageProvider'

type Note = {
  id: string
  conversation_id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
}

function formatNoteTime(value: string, language: 'en' | 'ar', unknownLabel: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return unknownLabel
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function ConversationNotes({
  conversationId,
  userId,
  author,
  onNotesExistChange,
}: {
  conversationId: string
  userId: string
  author: string
  onNotesExistChange: (hasNotes: boolean) => void
}) {
  const { direction, language, t } = useLanguage()
  const [notes, setNotes] = useState<Note[]>([])
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setNotes([])
    setEditingId(null)
    setEditBody('')
    setLoading(true)
    setError(null)

    async function loadNotes() {
      try {
        const { data, error: loadError } = await supabase
          .from('conversation_notes')
          .select('id,conversation_id,user_id,body,created_at,updated_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        if (loadError) throw loadError
        if (cancelled) return
        setNotes((data as Note[]) || [])
      } catch {
        if (cancelled) return
        setError(t('notesLoadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadNotes()
    return () => { cancelled = true }
  }, [conversationId, userId, language])

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanBody = body.trim()
    if (!cleanBody || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('conversation_notes')
        .insert({ conversation_id: conversationId, user_id: userId, body: cleanBody })
        .select('id,conversation_id,user_id,body,created_at,updated_at')
        .single()
      if (insertError || !data) setError(t('noteAddError'))
      else {
        setNotes((current) => [data as Note, ...current])
        setBody('')
        onNotesExistChange(true)
      }
    } catch {
      setError(t('noteAddError'))
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(noteId: string) {
    const cleanBody = editBody.trim()
    if (!cleanBody || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: updateError } = await supabase
        .from('conversation_notes')
        .update({ body: cleanBody, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .select('id,conversation_id,user_id,body,created_at,updated_at')
        .maybeSingle()
      if (updateError || !data) setError(t('noteUpdateError'))
      else {
        setNotes((current) => current.map((note) => note.id === noteId ? data as Note : note))
        setEditingId(null)
      }
    } catch {
      setError(t('noteUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(noteId: string) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: deleteError } = await supabase
        .from('conversation_notes')
        .delete()
        .eq('id', noteId)
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle()
      if (deleteError || !data) setError(t('noteDeleteError'))
      else {
        setNotes((current) => current.filter((note) => note.id !== noteId))
        if (notes.length === 1) onNotesExistChange(false)
      }
    } catch {
      setError(t('noteDeleteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="notes-content" dir={direction}>
      <p className="internal-only-label"><span aria-hidden="true">{t('private')}</span> {t('notesPrivacy')}</p>
      {error && <p className="notes-error" role="alert">{error}</p>}
      {loading ? (
        <div className="notes-loading" role="status">{t('loadingNotes')}</div>
      ) : notes.length === 0 && !error ? (
        <p className="notes-empty">{t('noNotes')}</p>
      ) : notes.length > 0 ? (
        <div className="notes-list">
          {notes.map((note) => (
            <article className="note-item" key={note.id}>
              <div className="note-meta"><strong>{author || t('signedInUser')}</strong><time dateTime={note.updated_at}>{formatNoteTime(note.updated_at, language, t('unknownTime'))}</time></div>
              {editingId === note.id ? (
                <div className="note-edit">
                  <textarea aria-label={t('edit')} dir="auto" maxLength={4000} value={editBody} onChange={(event) => setEditBody(event.target.value)} />
                  <div className="note-actions">
                    <button type="button" onClick={() => void saveEdit(note.id)} disabled={saving || !editBody.trim()}>{t('save')}</button>
                    <button type="button" className="quiet-action" onClick={() => setEditingId(null)} disabled={saving}>{t('cancel')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="note-body" dir="auto">{note.body}</p>
                  <div className="note-actions">
                    <button type="button" onClick={() => { setEditingId(note.id); setEditBody(note.body) }} disabled={saving}>{t('edit')}</button>
                    <button type="button" className="quiet-action" onClick={() => void deleteNote(note.id)} disabled={saving}>{t('delete')}</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <form className="note-form" onSubmit={addNote}>
        <label htmlFor="new-internal-note">{t('addNoteLabel')}</label>
        <textarea id="new-internal-note" dir="auto" maxLength={4000} placeholder={t('notePlaceholder')} value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="note-compose-actions"><span>{body.length}/4000</span><button type="submit" disabled={saving || !body.trim()}>{saving ? t('sending') : t('addNote')}</button></div>
      </form>
    </div>
  )
}