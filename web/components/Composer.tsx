"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from './LanguageProvider'

export default function Composer({ conversationId }: { conversationId: string }) {
  const { t } = useLanguage()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  async function send() {
    if (!text.trim() && !file) return
    setSending(true)
    setError(null)
    let messageStored = false
    try {
      // 1) If there is an image, upload it to Storage and get a private object path.
      let imageUrl: string | null = null
      if (file) {
        const path = conversationId + '/' + Date.now() + '-' + file.name
        const up = await supabase.storage.from('inbox-images').upload(path, file)
        if (up.error) {
          setError(t('attachmentUploadError'))
          return
        }
        imageUrl = 'storage://' + path.split('/').map(encodeURIComponent).join('/')
      }

      // 2) Save the user's message.
      const ins = await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        body: text.trim() || null,
        image_url: imageUrl,
      })
      if (ins.error) {
        setError(t('messageSendError'))
        return
      }
      messageStored = true
      setText('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      const preview = await supabase
        .from('conversations')
        .update({ last_message: text.trim() || '[image]', updated_at: new Date().toISOString() })
        .eq('id', conversationId)
      if (preview.error) setError(t('conversationPreviewError'))

      const webhook = process.env.NEXT_PUBLIC_N8N_AGENT_WEBHOOK
      if (!webhook) {
        setError(t('messageSentWebhookError'))
        return
      }
      const response = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      if (!response.ok) setError(t('messageSentWebhookError'))
    } catch (e) {
      setError(messageStored ? t('messageSentWebhookError') : t('messageSendError'))
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
      {error && <div className="error-text" role="alert">{error}</div>}
      <div className="field-row">
        <div className="attachment-control">
          <label className={'attachment-button' + (sending ? ' disabled' : '')} htmlFor="composer-attachment" title={t('attachFile')}>
            <span className="attachment-icon" aria-hidden="true" />
            <span className="attachment-button-label">{t('attachFile')}</span>
          </label>
          <input
            ref={fileInputRef}
            className="visually-hidden-input"
            id="composer-attachment"
            type="file"
            accept="image/*"
            disabled={sending}
            onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
          />
        </div>
        <textarea
          placeholder={t('messagePlaceholder')}
          dir="auto"
          value={text}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn" onClick={send} disabled={sending || (!text.trim() && !file)}>
          {sending ? t('sending') : t('send')}
        </button>
      </div>
      {file && (
        <div className="attachment-preview">
          {previewUrl ? <img src={previewUrl} alt={file.name} /> : <span className="attachment-file-icon" aria-hidden="true" />}
          <span className="attachment-name" title={file.name}>{file.name}</span>
          <button className="attachment-remove" type="button" aria-label={t('removeAttachment')} title={t('removeAttachment')} disabled={sending} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>×</button>
        </div>
      )}
    </div>
  )
}
