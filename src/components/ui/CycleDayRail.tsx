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
        return (
          <div
            key={d.dayNumber}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${pl.dayOfTotal(d.dayNumber, totalDays)} — ${d.status}`}
            className={cn(
              'flex-1 rounded-full motion-reduce:transition-none',
              isCurrent ? 'h-3 transition-[height] duration-200' : 'h-2.5',
            )}
            style={{
              background:
                d.status === 'completed'
                  ? 'var(--sr-success)'
                  : d.status === 'current'
                    ? 'var(--sr-brand-primary)'
                    : 'var(--sr-bg-surface)',
            }}
          />
        )
      })}
    </div>
  )
}
