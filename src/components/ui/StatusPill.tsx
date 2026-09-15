import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * StatusPill — the single label-chip system (tags, "Polecane", "Nowy rekord",
 * milestone markers, PRO). Interactive chips (filter buttons, plan badge
 * link) are a different idiom — they stay on their button/link chrome.
 *
 * Tones use existing semantic tokens; `brand-solid` = filled brand (reached
 * milestone), `outline` = quiet bordered (unreached milestone / muted tag).
 */
export function StatusPill({
  tone = 'neutral',
  size = 'sm',
  icon,
  ariaLabel,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'outline' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'brand-solid'
  size?: 'xs' | 'sm' | 'md'
  icon?: ReactNode
  /** Accessible name when the pill doubles as a labeled marker (e.g. PRO). */
  ariaLabel?: string
  children?: ReactNode
}) {
  return (
    <span
      aria-label={ariaLabel}
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--sr-radius-full)] font-semibold',
        size === 'xs' && 'px-1.5 py-0.5 sr-text-caption',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        tone === 'neutral' && 'bg-[var(--sr-bg-muted)] text-[var(--sr-text-secondary)]',
        tone === 'outline' &&
          'border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
        tone === 'success' && 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
        tone === 'warning' && 'bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]',
        tone === 'error' && 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
        tone === 'info' && 'bg-[var(--sr-info-muted)] text-[var(--sr-info)]',
        tone === 'brand' &&
          'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]',
        tone === 'brand-solid' && 'bg-[var(--sr-brand-primary)] text-white',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
