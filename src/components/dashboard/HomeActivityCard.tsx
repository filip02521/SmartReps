import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { StreakFlame, streakFlameBadgeStyle } from '@/components/dashboard/StreakFlame'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { Card } from '@/components/ui/Card'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { StatusPill } from '@/components/ui/StatusPill'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { StreakDetailSheet } from '@/components/dashboard/StreakDetailSheet'
import { pl } from '@/i18n/pl'
import {
  computeStreakWeeks,
  daysLeftInStreakWeek,
  getWeekKey,
  nextStreakMilestone,
  startOfLocalWeek,
} from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { useFrozenWeeks } from '@/lib/streak-freeze'
import type { LocalWorkoutSession } from '@/lib/db'
import type { HomeLoadResult } from '@/lib/home-summary'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

type Summary = HomeLoadResult['summary']

/** Count-up animation hook — animates from previous value to new value. */
function useCountUp(value: number, duration = 800): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value
    if (prev === value) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
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
  reps: number
  isCurrent: boolean
  isPartOfStreak: boolean
  isFrozen: boolean
}

function buildWeekCells(
  sessions: LocalWorkoutSession[],
  frozenWeeks: ReadonlySet<string>,
  weeks = 12,
): WeekCell[] {
  const now = new Date()
  const currentWeekStart = startOfLocalWeek(now)
  const currentWeekKey = getWeekKey(now)

  const weekMap = new Map<string, { sessions: number; reps: number }>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const key = getWeekKey(new Date(s.startedAt))
    const existing = weekMap.get(key) ?? { sessions: 0, reps: 0 }
    existing.sessions += 1
    existing.reps += s.totalReps ?? 0
    weekMap.set(key, existing)
  }

  const cells: WeekCell[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const key = getWeekKey(weekStart)
    cells.push({
      weekKey: key,
      weekStart,
      label: format(weekStart, 'd MMM', { locale: dateFnsLocale() }),
      sessions: weekMap.get(key)?.sessions ?? 0,
      reps: weekMap.get(key)?.reps ?? 0,
      isCurrent: key === currentWeekKey,
      isPartOfStreak: false,
      isFrozen: frozenWeeks.has(key),
    })
  }

  // Mark cells that are part of the current streak (from current week backwards)
  const streakSet = new Set<string>()
  const cursor = new Date(currentWeekStart)
  for (let i = 0; i < weeks; i++) {
    const key = getWeekKey(cursor)
    const hasSessions = (weekMap.get(key)?.sessions ?? 0) > 0 || frozenWeeks.has(key)
    if (hasSessions) {
      streakSet.add(key)
    } else if (i === 0 && key === currentWeekKey) {
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

function cellVisual(
  sessions: number,
  isPartOfStreak: boolean,
  isFrozen: boolean,
): { bg: string; border: string } {
  if (isFrozen) {
    return {
      bg: 'bg-[var(--sr-info-muted)]',
      border: 'border-[color-mix(in_srgb,var(--sr-info)_45%,transparent)]',
    }
  }
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

/** Merged "Twój tydzień" card — streak row + 12-week chain + 14-day metrics +
 *  trend insight in a single container (previously three separate cards). */
export function HomeActivityCard({
  summary,
  sessions,
}: {
  summary: Summary
  sessions: LocalWorkoutSession[]
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const completed = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions],
  )
  const frozenWeeks = useFrozenWeeks()
  const streak = useMemo(
    () => computeStreakWeeks(completed, new Date(), frozenWeeks),
    [completed, frozenWeeks],
  )
  const bestStreak = useMemo(
    () => computeBestStreakWeeks(completed, frozenWeeks),
    [completed, frozenWeeks],
  )
  const animatedStreak = useCountUp(streak)
  const cells = useMemo(
    () => buildWeekCells(completed, frozenWeeks),
    [completed, frozenWeeks],
  )

  const hasAnyTraining = completed.length > 0
  const currentWeekHasSessions = (cells[cells.length - 1]?.sessions ?? 0) > 0
  const isAtRisk = streak > 0 && !currentWeekHasSessions
  const isNewRecord = streak > 0 && streak >= bestStreak && bestStreak > 0
  const milestone = nextStreakMilestone(streak)
  const weeksToMilestone = milestone ? milestone - streak : 0

  return (
    <>
      <Card className="p-4">
        {/* Streak row — tap opens the detail sheet */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={
            hasAnyTraining
              ? pl.streakChainAria(streak, bestStreak)
              : pl.streakChainTitle
          }
          className={cn(
            FOCUS_RING,
            'group -m-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-[var(--sr-radius-md)] p-1 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
              streak === 0 && 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
            )}
            style={streakFlameBadgeStyle(streak)}
            aria-hidden
          >
            <StreakFlame
              streak={streak}
              size={22}
              strokeWidth={2.25}
              dying={isAtRisk}
            />
          </div>
          <div className="min-w-0 flex-1">
            {hasAnyTraining ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
                  {animatedStreak}
                </span>
                <span className="sr-text-caption text-[var(--sr-text-secondary)]">
                  {pl.streakChainWeeks(streak)}
                </span>
              </div>
            ) : (
              <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.streakChainTitle}
              </p>
            )}
            {/* Caption — the StatusPill already says "Nowy rekord!", so the
                caption carries the record context instead of repeating it. */}
            <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">
              {hasAnyTraining && bestStreak > 0
                ? pl.streakChainBest(bestStreak)
                : pl.streakChainEmpty}
            </p>
          </div>
          {/* Record pill yields to the at-risk warning — one message
              dominates at a time; loss aversion outranks celebration. */}
          {isNewRecord && !isAtRisk && (
            <StatusPill tone="success">{pl.streakChainNewRecord}</StatusPill>
          )}
          <ChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--sr-text-muted)] transition-colors group-hover:text-[var(--sr-text-primary)]"
          />
        </button>

        {/* 12-week chain */}
        <div
          className="mt-3 flex items-center gap-1"
          role="img"
          aria-label={pl.streakHeatmapMiniAria(streak)}
        >
          {cells.map((cell) => {
            const visual = cellVisual(
              cell.sessions,
              cell.isPartOfStreak,
              cell.isFrozen,
            )
            return (
              <div
                key={cell.weekKey}
                title={
                  cell.isFrozen
                    ? pl.streakFreezeCellTitle(cell.label)
                    : pl.streakHeatmapCellAria(cell.sessions, cell.reps, cell.label)
                }
                className={cn(
                  'h-7 flex-1 rounded-[var(--sr-radius-sm)] border transition-colors',
                  visual.bg,
                  visual.border,
                  cell.isCurrent &&
                    'ring-2 ring-[var(--sr-brand-primary)] ring-offset-1 ring-offset-[var(--sr-bg-surface)]',
                )}
              />
            )
          })}
        </div>

        {/* At-risk warning OR milestone progress — the risk strip pairs a
            countdown with an explicit loss statement (what disappears). */}
        {isAtRisk ? (
          <div className="mt-2 flex items-center gap-2 rounded-[var(--sr-radius-sm)] border border-[color-mix(in_srgb,var(--sr-warning)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))] px-2.5 py-1.5">
            <AlertTriangle
              size={14}
              className="shrink-0 text-[var(--sr-warning)]"
              aria-hidden
            />
            <p className="sr-text-caption font-medium text-[var(--sr-warning)]">
              {pl.streakAtRiskDaysLeft(daysLeftInStreakWeek())}
              {' — '}
              {pl.streakAtRiskLoss(streak)}
            </p>
          </div>
        ) : milestone ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="sr-text-caption text-[var(--sr-text-secondary)]">
              {pl.streakChainKeepGoing(weeksToMilestone)}
            </p>
            <span className="shrink-0 sr-text-caption font-semibold text-[var(--sr-brand-primary)]">
              {pl.streakChainMilestone(milestone)}
            </span>
          </div>
        ) : null}

        {/* 14-day metrics */}
        <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
          <MetricStrip
            metrics={[
              {
                value: summary.sessions14d,
                label: pl.homeSessions14d,
                hint: pl.homeSessions14dHint,
              },
              {
                value: summary.reps14d,
                label: pl.homeReps14d,
                hint: pl.homeReps14dHint,
              },
              {
                value:
                  summary.sessions14d > 0
                    ? Math.round(summary.reps14d / summary.sessions14d)
                    : pl.noValue,
                label: pl.homeAvgPerSession,
                hint: pl.homeAvgPerSessionHint,
              },
            ]}
            goal={{
              label: pl.homeGoalNin14(summary.goalTarget),
              current: summary.sessions14d,
              max: summary.goalTarget,
            }}
          />
        </div>

        <ActivityInsightsPanel
          insights={summary.activity}
          compact
          customLastWorkout={summary.customLastWorkout}
        />
      </Card>

      <StreakDetailSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sessions={sessions}
      />
    </>
  )
}
