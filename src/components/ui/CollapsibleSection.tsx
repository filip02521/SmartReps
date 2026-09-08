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
export function CollapsibleSection({
  title,
  icon: Icon,
  hint,
  children,
  defaultOpen = false,
  tone = 'default',
}: {
  title: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  hint?: string
  children: ReactNode
  defaultOpen?: boolean
  tone?: 'default' | 'danger'
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
            className={cn(
              'shrink-0',
              tone === 'danger'
                ? 'text-[var(--sr-error)]'
                : 'text-[var(--sr-text-muted)]',
            )}
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

      {/* Animated content — grid 0fr → 1fr trick for height: auto animation */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
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
