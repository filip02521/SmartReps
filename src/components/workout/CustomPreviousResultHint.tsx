import { History } from 'lucide-react'
import type { PrimaryMetric } from '@/lib/exercise-model'
import {
  formatPreviousCustomContext,
  formatPreviousCustomValue,
  hasPreviousCustomDisplay,
  type PreviousCustomSetResult,
} from '@/lib/custom-previous-result'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

export function CustomPreviousResultHint({
  result,
  metric,
  currentDayNumber,
  currentCycleAttempt,
  className,
}: {
  result: PreviousCustomSetResult
  metric: PrimaryMetric
  currentDayNumber: number
  currentCycleAttempt: number
  className?: string
}) {
  if (!hasPreviousCustomDisplay(result, metric)) return null

  const context = formatPreviousCustomContext(result, currentDayNumber, currentCycleAttempt)
  const value = formatPreviousCustomValue(result, metric)!

  return (
    <div className={cn('flex justify-center px-2', className)}>
      <p
        className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-[var(--sr-radius-full)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3 py-1.5 text-xs leading-snug text-[var(--sr-text-secondary)]"
        aria-label={pl.customPreviousAria(context, value)}
      >
        <History
          size={13}
          className="shrink-0 text-[var(--sr-brand-primary)]"
          aria-hidden
        />
        <span className="font-medium text-[var(--sr-text-muted)]">{pl.customPreviousLabel}</span>
        {context ? (
          <>
            <span aria-hidden className="text-[var(--sr-text-muted)]">
              ·
            </span>
            <span className="font-medium text-[var(--sr-brand-primary)]">{context}</span>
          </>
        ) : null}
        <span aria-hidden className="text-[var(--sr-text-muted)]">
          ·
        </span>
        <span className="font-semibold tabular-nums text-[var(--sr-text-primary)]">{value}</span>
      </p>
    </div>
  )
}
