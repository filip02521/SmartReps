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
        const completed = d.status === 'completed'
        return (
          <button
            key={d.dayNumber}
            type="button"
            role="listitem"
            aria-pressed={selected}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${pl.dayOfTotal(d.dayNumber, totalDays)} — ${d.status}`}
            className={cn(
              'flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] border text-center transition-colors',
              FOCUS_RING,
              selected && 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] ring-2 ring-[var(--sr-brand-primary)]/30',
              !selected && completed && 'border-[var(--sr-success)]/40 bg-[var(--sr-success-muted)]',
              !selected && isCurrent && 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
              !selected && !completed && !isCurrent && 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
            )}
            onClick={() => onSelect(d.dayNumber)}
          >
            <span
              className={cn(
                'text-base font-semibold tabular-nums',
                completed
                  ? 'text-[var(--sr-success)]'
                  : isCurrent || selected
                    ? 'text-[var(--sr-brand-primary)]'
                    : 'text-[var(--sr-text-primary)]',
              )}
            >
              {d.dayNumber}
            </span>
          </button>
        )
      })}
    </div>
  )
}
