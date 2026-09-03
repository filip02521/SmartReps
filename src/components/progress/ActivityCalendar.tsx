import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { LocalWorkoutSession } from '@/lib/db'

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

/**
 * Monthly calendar grid showing workout days.
 * Sessions are mapped to calendar dates — completed sessions get a filled dot,
 * failed sessions get a hollow dot, in-progress/abandoned are omitted.
 */
export function ActivityCalendar({ sessions }: { sessions: LocalWorkoutSession[] }) {
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11"
          aria-label={pl.calendarPrevMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={18} />
        </Button>
        <p className="sr-text-body-sm font-medium capitalize text-[var(--sr-text-primary)]">
          {format(cursor, 'LLLL yyyy', { locale: plLocale })}
        </p>
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
          const isToday = isSameDay(day, new Date())
          const isSelected = selectedDate && isSameDay(day, selectedDate)
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
                isToday && 'ring-1 ring-[var(--sr-brand-primary)]',
                isSelected && 'bg-[var(--sr-brand-primary)]/15',
                hasCompleted && 'bg-[var(--sr-brand-primary)]/10',
                !hasCompleted && 'cursor-default',
              )}
              aria-label={hasCompleted ? format(day, 'd MMMM yyyy', { locale: plLocale }) : undefined}
            >
              <span className={cn(
                'tabular-nums',
                hasCompleted ? 'font-semibold text-[var(--sr-brand-primary)]' : 'text-[var(--sr-text-muted)]',
              )}>
                {format(day, 'd')}
              </span>
              {hasCompleted && (
                <span className="mt-0.5 flex gap-0.5">
                  {Array.from({ length: Math.min(daySessions.length, 3) }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 w-1 rounded-full',
                        hasFailed && i === 0 ? 'bg-[var(--sr-error)]' : 'bg-[var(--sr-brand-primary)]',
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedSessions.length > 0 && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {format(selectedDate!, 'EEEE d MMMM yyyy', { locale: plLocale })}
          </p>
          <ul className="mt-2 space-y-1.5">
            {selectedSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-2 sr-text-body-sm">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    s.passed === false ? 'bg-[var(--sr-error)]' : 'bg-[var(--sr-brand-primary)]',
                  )}
                  aria-hidden
                />
                <span className="text-[var(--sr-text-primary)]">
                  {s.program === 'custom' ? pl.calendarSessionCustom : pl.calendarSessionBuiltin}
                </span>
                {s.totalReps != null && s.totalReps > 0 && (
                  <span className="text-[var(--sr-text-muted)]">· {s.totalReps} {pl.repUnit}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
