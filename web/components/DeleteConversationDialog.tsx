"use client"

import { useEffect, useRef } from 'react'

export default function DeleteConversationDialog({
  open,
  deleting,
  error,
  title,
  description,
  cancelLabel,
  deleteLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean
  deleting: boolean
  error: string | null
  title: string
  description: string
  cancelLabel: string
  deleteLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    function closeEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onCancel()
    }
    document.addEventListener('keydown', closeEscape)
    return () => document.removeEventListener('keydown', closeEscape)
  }, [deleting, onCancel, open])

  if (!open) return null

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel() }}>
      <section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
        <span className="delete-dialog-icon" aria-hidden="true">!</span>
        <h2 id="delete-dialog-title">{title}</h2>
        <p id="delete-dialog-description">{description}</p>
        {error && <p className="delete-dialog-error" role="alert">{error}</p>}
        <div className="delete-dialog-actions">
          <button ref={cancelRef} type="button" className="delete-cancel" disabled={deleting} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="delete-confirm" disabled={deleting} onClick={onConfirm}>{deleting ? `${deleteLabel}…` : deleteLabel}</button>
        </div>
      </section>
    </div>
  )
}