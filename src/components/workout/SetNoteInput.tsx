import { useState, useEffect, useRef } from 'react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function SetNoteInput({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const [expanded, setExpanded] = useState(!!value)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={cn(
          'mt-1.5 flex items-center gap-1.5 sr-text-body-sm text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text-secondary)]',
          FOCUS_RING,
        )}
        aria-label={pl.setNoteHint}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        {pl.setNoteHint}
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          // Live-propagate so parent state is current even if user taps Done without blur
          onChange(e.target.value.trim() || undefined)
        }}
        onBlur={() => {
          const trimmed = draft.trim()
          onChange(trimmed || undefined)
          if (!trimmed) setExpanded(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const trimmed = draft.trim()
            onChange(trimmed || undefined)
            if (!trimmed) setExpanded(false)
            inputRef.current?.blur()
          }
        }}
        placeholder={pl.setNotePlaceholder}
        maxLength={200}
        className={cn(
          'min-w-0 flex-1 rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2.5 py-1.5 sr-text-body-sm text-[var(--sr-text-primary)] placeholder:text-[var(--sr-text-muted)]',
          FOCUS_RING,
        )}
        aria-label={pl.setNoteLabel}
      />
      <button
        type="button"
        onClick={() => {
          const trimmed = draft.trim()
          onChange(trimmed || undefined)
          if (!trimmed) setExpanded(false)
        }}
        className={cn(
          'shrink-0 rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary)] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors',
          FOCUS_RING,
        )}
      >
        {pl.setNoteSave}
      </button>
    </div>
  )
}
