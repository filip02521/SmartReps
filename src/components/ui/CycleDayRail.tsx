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
  accent,
}: {
  days: CycleDayRailItem[]
  totalDays: number
  ariaLabel?: string
  className?: string
  /** Accent color for the current day — defaults to brand; program cards
   *  pass their program accent so the rail carries program identity. */
  accent?: string
}) {
  const currentColor = accent ?? 'var(--sr-brand-primary)'
  return (
    <div
      className={cn('flex items-end gap-1', className)}
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
              isCurrent ? 'h-3' : 'h-2',
            )}
            style={{
              background: isCompleted
                ? 'var(--sr-success)'
                : isCurrent
                  ? currentColor
                  : 'var(--sr-bg-surface)',
              boxShadow: isCurrent
                ? `0 0 8px color-mix(in srgb, ${currentColor} 40%, transparent)`
                : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
