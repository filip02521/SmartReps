import { cn } from '@/lib/utils'
import type { CycleDayStatus } from '@/lib/cycle-progress'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'

export type CycleDayPickerItem = {
  dayNumber: number
  status: CycleDayStatus
}

export function CycleDayPicker({
  days,
  totalDays,
  selectedDay,
  onSelect,
  className,
}: {
  days: CycleDayPickerItem[]
  totalDays: number
  selectedDay: number | null
  onSelect: (dayNumber: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="list" aria-label={pl.cycleDays}>
      {days.map((d) => {
        const selected = selectedDay === d.dayNumber
        const isCurrent = d.status === 'current'
        return (
          <button
            key={d.dayNumber}
            type="button"
            role="listitem"
            aria-pressed={selected}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${pl.dayOfTotal(d.dayNumber, totalDays)} — ${d.status}`}
            className={cn(
              'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-full border text-center transition-colors',
              FOCUS_RING,
              selected
                ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]'
                : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
            )}
            onClick={() => onSelect(d.dayNumber)}
          >
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                d.status === 'completed'
                  ? 'text-[var(--sr-success)]'
                  : isCurrent
                    ? 'text-[var(--sr-brand-primary)]'
                    : 'text-[var(--sr-text-primary)]',
              )}
            >
              {d.dayNumber}
            </span>
            <span className="sr-text-caption text-[var(--sr-text-muted)]">
              {d.status === 'completed' ? '✓' : d.status === 'current' ? '·' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
