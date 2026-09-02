import type { ReactNode } from 'react'
import { pl } from '@/i18n/pl'
import type { SessionHighlight } from '@/lib/session-summary-insights'
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

/** Session/exercise-level PR cards only — no aggregate “N rekordów” chips. */
export function SessionSummaryHighlights({
  highlights,
}: {
  prCount?: number
  progressCount?: number
  highlights: SessionHighlight[]
}) {
  const prHighlights = highlights.filter((h) => h.tone === 'pr')
  if (prHighlights.length === 0) return null

  return (
    <section className="mb-4" aria-label={pl.summaryHighlightsTitle}>
      <ul className="flex flex-col gap-2">
        {prHighlights.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/35 bg-[var(--sr-brand-primary-muted)] px-3 py-2.5"
          >
            <span className="text-sm font-medium text-[var(--sr-text-primary)]">{item.label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
