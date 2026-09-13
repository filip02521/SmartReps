import { useState, useId, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/**
 * Collapsible settings section with smooth expand/collapse animation.
 *
 * Uses the CSS grid-template-rows (0fr → 1fr) trick for animating
 * height: auto without measuring content. The chevron rotates 180deg
 * when expanded.
 *
 * Accessibility:
 * - Header is a <button> with aria-expanded and aria-controls
 * - Content region has role="region" and aria-labelledby
 * - Keyboard accessible (native button)
 */
const TONE_ICON: Record<string, string> = {
  default: 'text-[var(--sr-text-muted)]',
  success: 'text-[var(--sr-success)]',
  warning: 'text-[var(--sr-warning)]',
  danger: 'text-[var(--sr-error)]',
}

export function CollapsibleSection({
  title,
  icon: Icon,
  hint,
  count,
  children,
  defaultOpen = false,
  tone = 'default',
}: {
  title: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  hint?: string
  /** Item count shown as a small pill next to the title. */
  count?: number
  children: ReactNode
  defaultOpen?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const headerId = useId()

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--sr-radius-md)] border',
        tone === 'danger'
          ? 'border-[var(--sr-error)]/20'
          : 'border-[var(--sr-border-subtle)]',
        'bg-[var(--sr-bg-surface)]',
      )}
    >
      <button
        type="button"
        id={headerId}
        className={cn(
          FOCUS_RING,
          'flex min-h-12 w-full items-center gap-3 px-4 text-left',
          'transition-colors hover:bg-[var(--sr-bg-elevated)]',
        )}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
      >
        {Icon && (
          <Icon
            size={18}
            className={cn('shrink-0', TONE_ICON[tone] ?? TONE_ICON.default)}
          />
        )}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'text-sm font-semibold',
              tone === 'danger'
                ? 'text-[var(--sr-error)]'
                : 'text-[var(--sr-text-primary)]',
            )}
          >
            {title}
          </span>
          {count != null && count > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--sr-bg-elevated)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--sr-text-muted)]">
              {count}
            </span>
          )}
          {hint && !open && (
            <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
              {hint}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {/* Animated content — grid 0fr → 1fr trick for height: auto animation.
          `inert` when closed: 0-height + opacity-0 leaves children keyboard-
          focusable and readable by screen readers without it. */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--sr-border-subtle)] p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
