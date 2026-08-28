import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Flow section — divider + spacing, no card chrome (matches dashboard). */
export function ProgressSection({
  title,
  hint,
  children,
  className,
  first,
}: {
  title?: string
  hint?: string
  children: ReactNode
  className?: string
  first?: boolean
}) {
  return (
    <section
      className={cn(
        'border-t border-[var(--sr-border-subtle)] pt-5',
        first ? 'border-t-0 pt-0' : 'mt-5',
        className,
      )}
    >
      {title && <p className="sr-text-overline text-[var(--sr-text-muted)]">{title}</p>}
      {hint && (
        <p className={cn('sr-text-body-sm text-[var(--sr-text-secondary)]', title ? 'mt-0.5' : '')}>
          {hint}
        </p>
      )}
      <div className={cn(title || hint ? 'mt-3' : '')}>{children}</div>
    </section>
  )
}
