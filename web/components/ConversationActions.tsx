"use client"

import { useEffect, useRef, useState } from 'react'

export type ConversationActionLabels = {
  actions: string
  pin: string
  unpin: string
  delete: string
}

export default function ConversationActions({
  isPinned,
  direction,
  labels,
  disabled,
  onPin,
  onDelete,
}: {
  isPinned: boolean
  direction: 'ltr' | 'rtl'
  labels: ConversationActionLabels
  disabled?: boolean
  onPin: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    function positionMenu() {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const bounds = trigger.getBoundingClientRect()
      const margin = 10
      const left = direction === 'rtl'
        ? Math.max(margin, Math.min(bounds.left, window.innerWidth - menu.offsetWidth - margin))
        : Math.max(margin, Math.min(bounds.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - margin))
      const below = bounds.bottom + 6
      const top = below + menu.offsetHeight <= window.innerHeight - margin
        ? below
        : Math.max(margin, bounds.top - menu.offsetHeight - 6)
      setPosition({ top, left })
    }

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }

    function closeEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    positionMenu()
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [direction, open])

  return (
    <span className="conversation-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        className="conversation-actions-trigger"
        type="button"
        disabled={disabled}
        aria-label={labels.actions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          className="conversation-actions-menu"
          role="menu"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          <button type="button" role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onPin() }}>
            <span className="pin-icon" aria-hidden="true" />{isPinned ? labels.unpin : labels.pin}
          </button>
          <button className="conversation-delete-action" type="button" role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onDelete() }}>
            <span aria-hidden="true">×</span>{labels.delete}
          </button>
        </div>
      )}
    </span>
  )
}