import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function NestedStat({
  overline,
  value,
  hint,
  highlight,
  className,
  children,
}: {
  overline?: string
  value?: ReactNode
  hint?: ReactNode
  highlight?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-2.5',
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
            'text-sm font-semibold text-[var(--sr-text-primary)]',
            overline && 'mt-0.5',
            highlight && 'text-[var(--sr-brand-primary)]',
          )}
        >
          {value}
        </p>
      )}
      {hint != null && (
        <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">{hint}</p>
      )}
      {children}
    </div>
  )
}
