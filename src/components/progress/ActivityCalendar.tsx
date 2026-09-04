import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { LocalWorkoutSession } from '@/lib/db'
import type { NavigateFunction } from 'react-router-dom'

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

function sessionLabel(s: LocalWorkoutSession, customPlanNames: Record<string, string>): string {
  if (s.customPlanId) {
    return customPlanNames[s.customPlanId] ?? pl.calendarSessionCustom
  }
  if (s.program === 'pushups') return pl.pushupsProgram
  if (s.program === 'pullups') return pl.pullupsProgram
  return pl.calendarSessionBuiltin
}

function sessionRoute(s: LocalWorkoutSession): string {
  if (s.customPlanId) {
    return `/workout/custom/${s.customPlanId}/summary?session=${s.id}`
  }
  return `/workout/${s.program}/summary?session=${s.id}`
}

/**
 * Monthly calendar grid showing workout days.
 * Sessions are mapped to calendar dates — completed sessions get a filled dot,
 * failed sessions get a hollow dot, in-progress/abandoned are omitted.
 */
export function ActivityCalendar({
  sessions,
  customPlanNames = {},
  navigate,
}: {
  sessions: LocalWorkoutSession[]
  customPlanNames?: Record<string, string>
  navigate?: NavigateFunction
}) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, LocalWorkoutSession[]>()
    for (const s of sessions) {
      if (s.status !== 'completed') continue
      const dateKey = format(parseISO(s.startedAt), 'yyyy-MM-dd')
      const arr = map.get(dateKey) ?? []
      arr.push(s)
      map.set(dateKey, arr)
    }
    return map
  }, [sessions])

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const monthEnd = endOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor])

  const selectedSessions = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, 'yyyy-MM-dd')
    return sessionsByDay.get(key) ?? []
  }, [selectedDate, sessionsByDay])

  // Month stats
  const monthStats = useMemo(() => {
    let total = 0
    let passed = 0
    for (const day of days) {
      if (!isSameMonth(day, cursor)) continue
      const key = format(day, 'yyyy-MM-dd')
      const daySessions = sessionsByDay.get(key) ?? []
      total += daySessions.length
      passed += daySessions.filter((s) => s.passed === true).length
    }
    return { total, passed }
  }, [days, cursor, sessionsByDay])

  const hasMonthSessions = monthStats.total > 0

  return (
    <div>
      {/* Header: nav + month stats */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11"
          aria-label={pl.calendarPrevMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={18} />
        </Button>
        <div className="flex flex-col items-center text-center">
          <p className="sr-text-body-sm font-medium capitalize text-[var(--sr-text-primary)]">
            {format(cursor, 'LLLL yyyy', { locale: plLocale })}
          </p>
          {hasMonthSessions && (
            <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
              {pl.calendarMonthStats(monthStats.total, monthStats.passed)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11"
          aria-label={pl.calendarNextMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight size={18} />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="pb-1 text-center text-xs font-medium text-[var(--sr-text-muted)]">
            {wd}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor)
          const key = format(day, 'yyyy-MM-dd')
          const daySessions = sessionsByDay.get(key) ?? []
          const hasCompleted = daySessions.length > 0
          const hasFailed = daySessions.some((s) => s.passed === false)
          const hasPassed = daySessions.some((s) => s.passed === true)
          const isToday = isSameDay(day, new Date())
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const dotCount = Math.min(daySessions.length, 3)
          const hasMore = daySessions.length > 3
          return (
            <button
              key={key}
              type="button"
              disabled={!hasCompleted}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-[var(--sr-radius-sm)] text-xs transition-colors',
                FOCUS_RING,
                !inMonth && 'opacity-30',
                isToday && !isSelected && 'bg-[var(--sr-brand-primary-muted)]',
                isSelected && 'bg-[var(--sr-brand-primary)]/15 ring-1 ring-[var(--sr-brand-primary)]',
                hasCompleted && !isSelected && !isToday && 'bg-[var(--sr-brand-primary)]/8',
                !hasCompleted && 'cursor-default',
              )}
              aria-label={hasCompleted ? format(day, 'd MMMM yyyy', { locale: plLocale }) : undefined}
            >
              <span className={cn(
                'tabular-nums',
                hasCompleted
                  ? 'font-semibold text-[var(--sr-brand-primary)]'
                  : isToday
                    ? 'font-medium text-[var(--sr-brand-primary)]'
                    : 'text-[var(--sr-text-muted)]',
              )}>
                {format(day, 'd')}
              </span>
              {hasCompleted && (
                <span className="mt-0.5 flex items-center gap-0.5">
                  {Array.from({ length: dotCount }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        hasFailed && !hasPassed && i === 0
                          ? 'bg-[var(--sr-error)]'
                          : hasFailed && i === 0
                            ? 'bg-[var(--sr-error)]'
                            : 'bg-[var(--sr-brand-primary)]',
                      )}
                    />
                  ))}
                  {hasMore && (
                    <span className="text-[0.5rem] font-medium leading-none text-[var(--sr-text-muted)]">
                      +
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--sr-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--sr-brand-primary)]" aria-hidden />
          {pl.calendarLegendPassed}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--sr-error)]" aria-hidden />
          {pl.calendarLegendFailed}
        </span>
      </div>

      {/* Empty month notice */}
      {!hasMonthSessions && (
        <p className="mt-3 text-center text-sm text-[var(--sr-text-muted)]">
          {pl.calendarNoSessions}
        </p>
      )}

      {/* Selected day details */}
      {selectedSessions.length > 0 && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)] capitalize">
            {format(selectedDate!, 'EEEE d MMMM yyyy', { locale: plLocale })}
          </p>
          <ul className="mt-2 space-y-1.5">
            {selectedSessions.map((s) => {
              const canNavigate = navigate != null
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => {
                      if (!navigate) return
                      navigate(sessionRoute(s))
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[var(--sr-radius-sm)] py-1.5 text-left transition-colors',
                      canNavigate && 'hover:bg-[var(--sr-bg-elevated)] active:scale-[0.99]',
                      FOCUS_RING,
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        s.passed === false
                          ? 'bg-[var(--sr-error)]/15 text-[var(--sr-error)]'
                          : 'bg-[var(--sr-success)]/15 text-[var(--sr-success)]',
                      )}
                      aria-hidden
                    >
                      {s.passed === false ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate sr-text-body-sm text-[var(--sr-text-primary)]">
                      {sessionLabel(s, customPlanNames)}
                    </span>
                    {s.totalReps != null && s.totalReps > 0 && (
                      <span className="shrink-0 text-xs text-[var(--sr-text-muted)]">
                        {s.totalReps} {pl.repUnit}
                      </span>
                    )}
                    {canNavigate && (
                      <ChevronRightIcon size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
