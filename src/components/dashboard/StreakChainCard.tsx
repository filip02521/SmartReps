import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { pl } from '@/i18n/pl'
import { startOfLocalWeek, getWeekKey, computeStreakWeeks } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { StreakDetailSheet } from './StreakDetailSheet'

/** Count-up animation hook — animates from previous value to new value. */
function useCountUp(value: number, duration = 800): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    if (prev === value) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(prev + (value - prev) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return display
}

type WeekCell = {
  weekKey: string
  weekStart: Date
  label: string
  sessions: number
  isCurrent: boolean
  isPartOfStreak: boolean
}

function buildWeekCells(sessions: LocalWorkoutSession[], weeks = 12): WeekCell[] {
  const now = new Date()
  const currentWeekStart = startOfLocalWeek(now)
  const currentWeekKey = getWeekKey(now)

  const weekMap = new Map<string, number>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const key = getWeekKey(new Date(s.startedAt))
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1)
  }

  const cells: WeekCell[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const key = getWeekKey(weekStart)
    const sessionsCount = weekMap.get(key) ?? 0
    cells.push({
      weekKey: key,
      weekStart,
      label: format(weekStart, 'd MMM', { locale: dateFnsLocale() }),
      sessions: sessionsCount,
      isCurrent: key === currentWeekKey,
      isPartOfStreak: false,
    })
  }

  // Mark cells that are part of the current streak (from current week backwards)
  const streakSet = new Set<string>()
  const cursor = new Date(currentWeekStart)
  for (let i = 0; i < weeks; i++) {
    const key = getWeekKey(cursor)
    const hasSessions = (weekMap.get(key) ?? 0) > 0
    // Current week: if no sessions yet, still counts as "in streak" (at risk)
    if (hasSessions) {
      streakSet.add(key)
    } else if (i === 0 && key === currentWeekKey) {
      // At-risk: mark current week but continue to previous weeks
      streakSet.add(key)
      cursor.setDate(cursor.getDate() - 7)
      continue
    } else {
      break
    }
    cursor.setDate(cursor.getDate() - 7)
  }
  for (const cell of cells) {
    cell.isPartOfStreak = streakSet.has(cell.weekKey)
  }

  return cells
}

function cellVisual(sessions: number, isPartOfStreak: boolean): {
  bg: string
  border: string
} {
  if (sessions === 0) {
    return {
      bg: isPartOfStreak
        ? 'bg-[color-mix(in_srgb,var(--sr-warning)_15%,var(--sr-bg-surface))]'
        : 'bg-[var(--sr-bg-surface)]',
      border: isPartOfStreak
        ? 'border-[color-mix(in_srgb,var(--sr-warning)_40%,transparent)]'
        : 'border-[var(--sr-border-subtle)]',
    }
  }
  if (sessions <= 2) {
    return {
      bg: 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_35%,var(--sr-bg-surface))]',
      border: 'border-[color-mix(in_srgb,var(--sr-brand-primary)_30%,transparent)]',
    }
  }
  if (sessions <= 4) {
    return {
      bg: 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_60%,var(--sr-bg-surface))]',
      border: 'border-[color-mix(in_srgb,var(--sr-brand-primary)_45%,transparent)]',
    }
  }
  return {
    bg: 'bg-[var(--sr-brand-primary)]',
    border: 'border-[var(--sr-brand-primary)]',
  }
}

const MILESTONES = [4, 8, 12, 26, 52]

function nextMilestone(current: number): number | null {
  for (const m of MILESTONES) {
    if (current < m) return m
  }
  return null
}

export function StreakChainCard({ sessions }: { sessions: LocalWorkoutSession[] }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const completed = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions],
  )
  const streak = useMemo(() => computeStreakWeeks(completed), [completed])
  const bestStreak = useMemo(() => computeBestStreakWeeks(completed), [completed])
  const animatedStreak = useCountUp(streak)
  const cells = useMemo(() => buildWeekCells(completed), [completed])

  const hasAnyTraining = completed.length > 0
  const currentWeekHasSessions = (cells[cells.length - 1]?.sessions ?? 0) > 0
  const isAtRisk = streak > 0 && !currentWeekHasSessions
  const isNewRecord = streak > 0 && streak >= bestStreak && bestStreak > 0
  const milestone = nextMilestone(streak)
  const weeksToMilestone = milestone ? milestone - streak : 0

  if (!hasAnyTraining) {
    return (
      <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={pl.streakChainTitle}
        className={cn(
          FOCUS_RING,
          'group mt-3 flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
        )}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]"
          aria-hidden
        >
          <Flame size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.streakChainTitle}
          </p>
          <p className="mt-0.5 sr-text-caption text-[var(--sr-text-secondary)]">
            {pl.streakChainEmpty}
          </p>
        </div>
        <ChevronRight
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--sr-text-muted)] transition-colors group-hover:text-[var(--sr-text-primary)]"
        />
      </button>
      <StreakDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sessions={sessions} />
      </>
    )
  }

  return (
    <>
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      aria-label={pl.streakChainAria(streak, bestStreak)}
      className={cn(
        FOCUS_RING,
        'group mt-3 flex w-full flex-col gap-3 rounded-[var(--sr-radius-lg)] border p-4 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
        isAtRisk
          ? 'border-[color-mix(in_srgb,var(--sr-warning)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_6%,var(--sr-bg-surface))]'
          : streak > 0
            ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_25%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_6%,var(--sr-bg-surface))]'
            : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
      )}
    >
      {/* Top row: flame + streak number + best/record */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
              streak > 0
                ? 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)] text-[var(--sr-brand-primary)]'
                : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
            )}
            aria-hidden
          >
            <Flame
              size={22}
              strokeWidth={2.25}
              className={cn(streak > 0 && 'sr-flame-pulse')}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
                {animatedStreak}
              </span>
            </div>
            <p className="mt-1 sr-text-caption text-[var(--sr-text-secondary)]">
              {pl.streakChainWeeks(streak)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isNewRecord ? (
            <span className="rounded-[var(--sr-radius-full)] bg-[var(--sr-success-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sr-success)]">
              {pl.streakChainNewRecord}
            </span>
          ) : bestStreak > 0 ? (
            <span className="sr-text-caption text-[var(--sr-text-muted)]">
              {pl.streakChainBest(bestStreak)}
            </span>
          ) : null}
          <ChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--sr-text-muted)] transition-colors group-hover:text-[var(--sr-text-primary)]"
          />
        </div>
      </div>

      {/* Chain visualization — connected cells */}
      <div className="flex items-center gap-1" role="img" aria-label={pl.streakHeatmapMiniAria(streak)}>
        {cells.map((cell) => {
          const visual = cellVisual(cell.sessions, cell.isPartOfStreak)
          return (
            <div
              key={cell.weekKey}
              title={pl.streakHeatmapCellAria(cell.sessions, 0, cell.label)}
              className={cn(
                'h-7 flex-1 rounded-[var(--sr-radius-sm)] border transition-colors',
                visual.bg,
                visual.border,
                cell.isCurrent && 'ring-2 ring-[var(--sr-brand-primary)] ring-offset-1 ring-offset-[var(--sr-bg-surface)]',
              )}
            />
          )
        })}
      </div>

      {/* Bottom row: at-risk warning OR milestone progress */}
      {isAtRisk ? (
        <p className="sr-text-caption font-medium text-[var(--sr-warning)]">
          {pl.streakChainAtRisk}
        </p>
      ) : milestone ? (
        <div className="flex items-center justify-between gap-2">
          <p className="sr-text-caption text-[var(--sr-text-secondary)]">
            {pl.streakChainKeepGoing(weeksToMilestone)}
          </p>
          <span className="shrink-0 sr-text-caption font-semibold text-[var(--sr-brand-primary)]">
            {pl.streakChainMilestone(milestone)}
          </span>
        </div>
      ) : null}
    </button>
    <StreakDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sessions={sessions} />
    </>
  )
}
