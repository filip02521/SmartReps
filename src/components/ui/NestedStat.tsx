import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function NestedStat({
  overline,
  value,
  hint,
  highlight,
  size = 'sm',
  className,
  children,
}: {
  overline?: string
  value?: ReactNode
  hint?: ReactNode
  highlight?: boolean
  /** sm = compact; md = scannable daily; lg = hero number */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] transition-colors hover:border-[var(--sr-border-strong)]',
        size === 'lg' ? 'px-4 py-3.5' : 'px-3 py-2.5',
        highlight && 'ring-1 ring-[var(--sr-brand-primary)]',
        className,
      )}
    >
      {overline && (
        <p className="sr-text-overline text-[var(--sr-text-muted)]">{overline}</p>
      )}
      {value != null && (
        <p
          className={cn(
            'font-semibold tabular-nums text-[var(--sr-text-primary)]',
            overline && 'mt-0.5',
            size === 'sm' && 'text-sm',
            size === 'md' && 'sr-text-h3 leading-snug',
            size === 'lg' && 'text-2xl leading-tight',
            highlight && 'text-[var(--sr-brand-primary)]',
          )}
        >
          {value}
        </p>
      )}
      {hint != null && (
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{hint}</p>
      )}
      {children}
    </div>
  )
}
