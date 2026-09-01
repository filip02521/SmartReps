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

export function SessionSummaryHighlights({
  prCount,
  progressCount,
  highlights,
}: {
  prCount: number
  progressCount: number
  highlights: SessionHighlight[]
}) {
  if (prCount === 0 && progressCount === 0 && highlights.length === 0) return null

  return (
    <section className="mb-4" aria-label={pl.summaryHighlightsTitle}>
      {(prCount > 0 || progressCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {prCount > 0 && (
            <SummaryInsightBadge tone="pr">{pl.summaryHighlightsPrCount(prCount)}</SummaryInsightBadge>
          )}
          {progressCount > 0 && (
            <SummaryInsightBadge tone="progress">
              {pl.summaryHighlightsProgressCount(progressCount)}
            </SummaryInsightBadge>
          )}
        </div>
      )}

      {highlights.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {highlights.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-[var(--sr-radius-md)] border px-3 py-2.5',
                item.tone === 'pr'
                  ? 'border-[var(--sr-brand-primary)]/35 bg-[var(--sr-brand-primary-muted)]'
                  : 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]',
              )}
            >
              <span className="text-sm font-medium text-[var(--sr-text-primary)]">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
