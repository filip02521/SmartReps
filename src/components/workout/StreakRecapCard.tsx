import { useMemo } from 'react'
import { Flame, TrendingUp, ShieldCheck } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { computeStreakWeeks, getWeekKey } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'

const MILESTONES = [4, 8, 12, 26, 52]

function nextMilestone(current: number): number | null {
  for (const m of MILESTONES) {
    if (current < m) return m
  }
  return null
}

function milestoneJustReached(prevStreak: number, newStreak: number): number | null {
  for (const m of MILESTONES) {
    if (prevStreak < m && newStreak >= m) return m
  }
  return null
}

/**
 * Detect "streak saved" scenario: before this workout, the user had a streak
 * but no session in the current week (at-risk). After completing, the streak
 * is preserved (not increased, but not broken either).
 */
function wasAtRisk(prevSessions: LocalWorkoutSession[]): boolean {
  const prevStreak = computeStreakWeeks(prevSessions.filter((s) => s.status === 'completed'))
  if (prevStreak === 0) return false
  const currentWeekKey = getWeekKey(new Date())
  return !prevSessions.some(
    (s) => s.status === 'completed' && getWeekKey(new Date(s.startedAt)) === currentWeekKey,
  )
}

/**
 * Compact streak recap card shown on session summary pages.
 * Celebrates the streak increase after completing a workout.
 */
export function StreakRecapCard({
  sessions,
  /** Sessions before this workout — used to detect streak increase. */
  previousSessions,
}: {
  sessions: LocalWorkoutSession[]
  previousSessions: LocalWorkoutSession[]
}) {
  const newStreak = useMemo(
    () => computeStreakWeeks(sessions.filter((s) => s.status === 'completed')),
    [sessions],
  )
  const prevStreak = useMemo(
    () => computeStreakWeeks(previousSessions.filter((s) => s.status === 'completed')),
    [previousSessions],
  )
  const bestStreak = useMemo(
    () => computeBestStreakWeeks(sessions.filter((s) => s.status === 'completed')),
    [sessions],
  )

  const streakIncreased = newStreak > prevStreak
  const milestone = milestoneJustReached(prevStreak, newStreak)
  const isNewRecord = newStreak > 0 && newStreak >= bestStreak && bestStreak > 0
  const next = nextMilestone(newStreak)
  const weeksToNext = next ? next - newStreak : 0
  const streakSaved = !streakIncreased && !milestone && wasAtRisk(previousSessions)

  // Don't show card if nothing celebratory happened
  if (!streakIncreased && !milestone && !streakSaved) return null

  const isLegendary = newStreak >= 26
  const isHot = newStreak >= 12
  // "Saved" uses success green to differentiate from increase (brand) and milestone (gold)
  const isSavedState = streakSaved && !milestone

  return (
    <div
      className={cn(
        'mb-6 flex items-center gap-4 rounded-[var(--sr-radius-lg)] border p-4',
        'sr-streak-recap-enter',
        milestone
          ? 'border-[color-mix(in_srgb,var(--sr-warning)_40%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))]'
          : isSavedState
            ? 'border-[color-mix(in_srgb,var(--sr-success)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-success)_6%,var(--sr-bg-surface))]'
            : isLegendary
              ? 'border-[color-mix(in_srgb,var(--sr-warning)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_6%,var(--sr-bg-surface))]'
              : isHot
                ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))]'
                : 'border-[color-mix(in_srgb,var(--sr-brand-primary)_25%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_6%,var(--sr-bg-surface))]',
      )}
    >
      {/* Icon — ShieldCheck for "saved", Flame for increase/milestone */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
          milestone || isLegendary
            ? 'bg-[color-mix(in_srgb,var(--sr-warning)_15%,transparent)] text-[var(--sr-warning)]'
            : isSavedState
              ? 'bg-[color-mix(in_srgb,var(--sr-success)_15%,transparent)] text-[var(--sr-success)]'
              : 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)] text-[var(--sr-brand-primary)]',
        )}
        style={{ height: isLegendary ? 56 : 48, width: isLegendary ? 56 : 48 }}
        aria-hidden
      >
        {isSavedState ? (
          <ShieldCheck size={26} strokeWidth={2.25} />
        ) : (
          <Flame
            size={isLegendary ? 30 : 24}
            strokeWidth={2.25}
            className="sr-flame-pulse"
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-bold tabular-nums leading-none',
              milestone || isLegendary
                ? 'text-[var(--sr-warning)]'
                : isSavedState
                  ? 'text-[var(--sr-success)]'
                  : 'text-[var(--sr-brand-primary)]',
            )}
            style={{ fontSize: isLegendary ? '2rem' : '1.75rem' }}
          >
            {newStreak}
          </span>
          <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.streakChainWeeks(newStreak)}
          </span>
        </div>

        {/* Status line — priority: milestone > new record > saved > progress */}
        {milestone ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-warning)]">
            {pl.streakRecapMilestone(milestone)}
          </p>
        ) : isNewRecord ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-success)]">
            {pl.streakRecapNewRecord}
          </p>
        ) : isSavedState ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-success)]">
            {pl.streakRecapSaved}
          </p>
        ) : next ? (
          <p className="mt-1 sr-text-caption text-[var(--sr-text-secondary)]">
            {pl.streakChainKeepGoing(weeksToNext)}
          </p>
        ) : null}
      </div>

      {/* Best streak indicator */}
      {bestStreak > 0 && !isNewRecord && !isSavedState && (
        <div className="flex shrink-0 items-center gap-1 text-[var(--sr-text-muted)]">
          <TrendingUp size={14} aria-hidden />
          <span className="sr-text-caption tabular-nums">{bestStreak}</span>
        </div>
      )}
    </div>
  )
}
