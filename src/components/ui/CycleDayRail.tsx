import { cn } from '@/lib/utils'
import type { CycleDayStatus } from '@/lib/cycle-progress'
import { pl } from '@/i18n/pl'

export type CycleDayRailItem = {
  dayNumber: number
  status: CycleDayStatus
}

export function CycleDayRail({
  days,
  totalDays,
  ariaLabel,
  className,
}: {
  days: CycleDayRailItem[]
  totalDays: number
  ariaLabel?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex items-end gap-1.5', className)}
      role="list"
      aria-label={ariaLabel ?? pl.cycleDays}
    >
      {days.map((d) => {
        const isCurrent = d.status === 'current'
        const isCompleted = d.status === 'completed'
        return (
          <div
            key={d.dayNumber}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${pl.dayOfTotal(d.dayNumber, totalDays)} — ${
              isCompleted
                ? pl.cycleDayStatusCompleted
                : isCurrent
                  ? pl.cycleDayStatusCurrent
                  : pl.cycleDayStatusFuture
            }`}
            className={cn(
              'flex-1 rounded-full transition-all duration-200 motion-reduce:transition-none',
              isCurrent ? 'h-3.5' : 'h-2.5',
              isCurrent && 'shadow-[0_0_8px_var(--sr-brand-primary-muted)]',
            )}
            style={{
              background: isCompleted
                ? 'var(--sr-success)'
                : isCurrent
                  ? 'var(--sr-brand-primary)'
                  : 'var(--sr-bg-surface)',
            }}
          />
        )
      })}
    </div>
  )
}
