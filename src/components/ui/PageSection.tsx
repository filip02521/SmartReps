import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageSection({
  title,
  hint,
  children,
  className,
  titleAs: TitleTag = 'h2',
  icon: Icon,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  titleAs?: 'h2' | 'h3'
  icon?: LucideIcon
}) {
  // Overline + icon — same section language as SectionHeader (dashboard)
  // and ProgressSection (progress), so every tab reads identically.
  return (
    <section className={cn('mt-6', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <Icon
            size={16}
            className="shrink-0 text-[var(--sr-text-muted)]"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
        <TitleTag className="min-w-0 break-words sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {title}
        </TitleTag>
      </div>
      {hint != null && (
        <p className="mt-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">{hint}</p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  )
}
