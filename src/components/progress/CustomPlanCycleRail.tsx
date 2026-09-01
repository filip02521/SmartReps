import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import type { CustomPlan, CustomProgramProgress } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'
import {
  resolveCustomCycleDayStatus,
  sessionsForCycleAttempt,
  type CustomCycleDayStatus,
} from '@/lib/custom-plan-cycle-rail'

const statusLabel: Record<CustomCycleDayStatus, string> = {
  passed: pl.customCycleDayPassed,
  failed: pl.customCycleDayFailed,
  current: pl.customCycleDayCurrent,
  upcoming: pl.customCycleDayUpcoming,
  rest: pl.customCycleDayRest,
}

export function CustomPlanCycleRail({
  plan,
  progress,
  sessions,
  onDayClick,
}: {
  plan: CustomPlan
  progress: CustomProgramProgress | null
  sessions: LocalWorkoutSession[]
  onDayClick?: (dayNumber: number) => void
}) {
  const attemptSessions = progress
    ? sessionsForCycleAttempt(sessions, progress.cycleAttempt)
    : sessions
  const sortedDays = [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber)
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-min gap-2 pb-1">
        {sortedDays.map((day) => {
          const status = resolveCustomCycleDayStatus(day.dayNumber, progress, attemptSessions)
          return (
            <button
              key={day.dayNumber}
              type="button"
              className={cn(
                'flex min-w-[4.5rem] flex-col items-center rounded-[var(--sr-radius-md)] border px-3 py-2 text-center transition-colors',
                'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
                status === 'current' && 'border-[var(--sr-brand-primary)]',
                status === 'passed' && 'border-[var(--sr-success)]/40',
                status === 'failed' && 'border-[var(--sr-error)]/40',
                'hover:border-[var(--sr-border-strong)]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]',
              )}
              onClick={() => onDayClick?.(day.dayNumber)}
            >
              <span className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.dayLabel(day.dayNumber)}
              </span>
              <span className="mt-1 text-xs font-medium text-[var(--sr-text-secondary)]">
                {statusLabel[status]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
