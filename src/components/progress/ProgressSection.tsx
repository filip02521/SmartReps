import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Flow section — divider + spacing, no card chrome (matches dashboard). */
export function ProgressSection({
  title,
  hint,
  icon: Icon,
  children,
  className,
  first,
  id,
}: {
  title?: string
  hint?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  first?: boolean
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-t border-[var(--sr-border-subtle)] pt-6',
        first ? 'border-t-0 pt-0' : 'mt-6',
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              size={16}
              className="text-[var(--sr-text-muted)]"
              strokeWidth={2.25}
              aria-hidden
            />
          )}
          <p className="sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            {title}
          </p>
        </div>
      )}
      {hint && (
        <p className={cn('sr-text-body-sm text-[var(--sr-text-secondary)]', title ? 'mt-1' : '')}>
          {hint}
        </p>
      )}
      <div className={cn(title || hint ? 'mt-3.5' : '')}>{children}</div>
    </section>
  )
}
