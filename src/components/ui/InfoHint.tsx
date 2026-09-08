import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'

/**
 * Inline `?` icon that reveals a hint popover on tap.
 * Designed for mobile-first PWA — no hover dependency.
 *
 * - Tap `?` to toggle a small popover bubble with hint text
 * - Dismisses on outside click or Escape
 * - Accessible: button with aria-expanded, tooltip role
 * - Popover positioned below-left, max 240px, z-50
 */
export function InfoHint({
  text,
  className,
}: {
  text: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <span ref={ref} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={pl.infoHintLabel}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center rounded-full text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text-secondary)]',
          FOCUS_RING,
        )}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 block max-w-[240px] rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-2.5 text-xs leading-relaxed text-[var(--sr-text-secondary)] shadow-lg',
          )}
        >
          {text}
        </span>
      )}
    </span>
  )
}
