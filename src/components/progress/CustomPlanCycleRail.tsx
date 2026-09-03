import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import type { CustomPlan, CustomProgramProgress, PlanDay } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'
import {
  resolveCustomCycleDayStatus,
  sessionsForCycleAttempt,
  type CustomCycleDayStatus,
} from '@/lib/custom-plan-cycle-rail'
import { FOCUS_RING } from '@/lib/ui-chrome'

const statusAria: Record<CustomCycleDayStatus, string> = {
  passed: pl.customCycleDayPassed,
  failed: pl.customCycleDayFailed,
  current: pl.customCycleDayCurrent,
  upcoming: pl.customCycleDayUpcoming,
  rest: pl.customCycleDayRest,
}

function dayTone(status: CustomCycleDayStatus, selected: boolean): string {
  // Selection wins — only one day should read as “picked”
  if (selected) {
    return 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] ring-2 ring-[var(--sr-brand-primary)]/35'
  }
  switch (status) {
    case 'passed':
      return 'border-[var(--sr-success)]/40 bg-[var(--sr-success-muted)]'
    case 'failed':
      return 'border-[var(--sr-error)]/40 bg-[var(--sr-error-muted)]'
    case 'rest':
      return 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]'
    case 'current':
      // Current but not selected: outline only, no fill (avoid looking “stuck” on day 1)
      return 'border-[var(--sr-brand-primary)] bg-[var(--sr-bg-surface)]'
    default:
      return 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]'
  }
}

function dayNumberTone(status: CustomCycleDayStatus, selected: boolean): string {
  if (selected) return 'text-[var(--sr-brand-primary)]'
  if (status === 'passed') return 'text-[var(--sr-success)]'
  if (status === 'failed') return 'text-[var(--sr-error)]'
  if (status === 'current') return 'text-[var(--sr-brand-primary)]'
  return 'text-[var(--sr-text-primary)]'
}

function exerciseCount(day: PlanDay): number {
  return day.exercises.length
}

export function CustomPlanCycleRail({
  plan,
  progress,
  sessions,
  selectedDay,
  onDayClick,
}: {
  plan: CustomPlan
  progress: CustomProgramProgress | null
  sessions: LocalWorkoutSession[]
  /** Explicitly selected day for preview — not inferred as “always 1”. */
  selectedDay: number | null
  onDayClick?: (dayNumber: number) => void
}) {
  const attemptSessions = progress
    ? sessionsForCycleAttempt(sessions, progress.cycleAttempt)
    : sessions
  const sortedDays = [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber)
  const totalDays = sortedDays.length

  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label={pl.progressCustomPlanMapTitle}
    >
      {sortedDays.map((day) => {
        const status = resolveCustomCycleDayStatus(day.dayNumber, progress, attemptSessions)
        const selected = selectedDay === day.dayNumber
        const n = exerciseCount(day)
        return (
          <button
            key={day.dayNumber}
            type="button"
            role="listitem"
            aria-current={status === 'current' ? 'step' : undefined}
            aria-pressed={selected}
            aria-label={`${pl.dayOfTotal(day.dayNumber, totalDays)} — ${statusAria[status]} · ${pl.progressCustomDayExercises(n)}`}
            className={cn(
              FOCUS_RING,
              'flex min-h-12 min-w-12 flex-col items-center justify-center rounded-[var(--sr-radius-md)] border px-2.5 py-1.5 text-center transition-colors',
              dayTone(status, selected),
            )}
            onClick={() => onDayClick?.(day.dayNumber)}
          >
            <span
              className={cn(
                'text-base font-semibold tabular-nums leading-none',
                dayNumberTone(status, selected),
              )}
            >
              {day.dayNumber}
            </span>
            {n > 0 && (
              <span className="mt-1 sr-text-caption leading-none text-[var(--sr-text-muted)]">
                {n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
