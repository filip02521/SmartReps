import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SummaryInsightBadge({
  tone,
  children,
  className,
}: {
  tone: 'pr' | 'progress' | 'down'
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        tone === 'pr' && 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]',
        tone === 'progress' && 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
        tone === 'down' && 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
        className,
      )}
    >
      {children}
    </span>
  )
}
