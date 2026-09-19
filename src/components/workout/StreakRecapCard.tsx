import { useMemo } from 'react'
import { TrendingUp, ShieldCheck } from 'lucide-react'
import {
  StreakFlame,
  streakFlameBadgeStyle,
  streakFlameColor,
  streakFlameTier,
} from '@/components/dashboard/StreakFlame'
import { pl } from '@/i18n/pl'
import {
  computeStreakWeeks,
  getWeekKey,
  nextStreakMilestone,
  justReachedStreakMilestone,
} from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { useFrozenWeeks } from '@/lib/streak-freeze'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'

/**
 * Detect "streak saved" scenario: before this workout, the user had a streak
 * (sessions in previous weeks) but no session in the current week (at-risk).
 * After completing, the streak is preserved/extended.
 */
function wasAtRisk(
  prevSessions: LocalWorkoutSession[],
  frozenWeeks: ReadonlySet<string>,
): boolean {
  const completed = prevSessions.filter((s) => s.status === 'completed')
  const prevStreak = computeStreakWeeks(completed, new Date(), frozenWeeks)
  if (prevStreak === 0) return false
  const currentWeekKey = getWeekKey(new Date())
  return !completed.some(
    (s) => getWeekKey(new Date(s.startedAt)) === currentWeekKey,
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
  const frozenWeeks = useFrozenWeeks()
  const newStreak = useMemo(
    () =>
      computeStreakWeeks(
        sessions.filter((s) => s.status === 'completed'),
        new Date(),
        frozenWeeks,
      ),
    [sessions, frozenWeeks],
  )
  const prevStreak = useMemo(
    () =>
      computeStreakWeeks(
        previousSessions.filter((s) => s.status === 'completed'),
        new Date(),
        frozenWeeks,
      ),
    [previousSessions, frozenWeeks],
  )
  const bestStreak = useMemo(
    () =>
      computeBestStreakWeeks(
        sessions.filter((s) => s.status === 'completed'),
        frozenWeeks,
      ),
    [sessions, frozenWeeks],
  )

  const streakIncreased = newStreak > prevStreak
  const milestone = justReachedStreakMilestone(prevStreak, newStreak)
  const isNewRecord = newStreak > 0 && newStreak >= bestStreak && bestStreak > 0
  const next = nextStreakMilestone(newStreak)
  const weeksToNext = next ? next - newStreak : 0
  const atRiskBefore = wasAtRisk(previousSessions, frozenWeeks)
  // "Streak saved" = user was at-risk (no session this week before) and completed a workout.
  // The streak may have increased (from "at-risk count" to "active count"), but the emotional
  // message is "saved" not "increased" — the user preserved their streak from breaking.
  const streakSaved = atRiskBefore && streakIncreased && !milestone

  // Don't show card if nothing celebratory happened
  if (!streakIncreased && !milestone && !streakSaved) return null

  const flameTier = streakFlameTier(newStreak)
  const isLegendary = flameTier >= 5
  const isHot = flameTier >= 4
  // "Saved" uses success green to differentiate from increase (brand) and milestone (gold)
  const isSavedState = streakSaved

  return (
    <div
      className={cn(
        'mb-6 flex items-center gap-4 rounded-[var(--sr-radius-lg)] border p-4',
        'sr-streak-recap-enter',
        milestone
          ? 'border-[color-mix(in_srgb,var(--sr-warning)_40%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))]'
          : isSavedState
            ? 'border-[color-mix(in_srgb,var(--sr-success)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-success)_6%,var(--sr-bg-surface))]'
            : 'border-[var(--sr-border-subtle)]',
      )}
      style={
        !milestone && !isSavedState
          ? {
              borderColor: `color-mix(in srgb, ${streakFlameColor(newStreak)} ${isHot ? 30 : 25}%, var(--sr-border-subtle))`,
              backgroundColor: `color-mix(in srgb, ${streakFlameColor(newStreak)} ${isHot ? 8 : 6}%, var(--sr-bg-surface))`,
            }
          : undefined
      }
    >
      {/* Icon — ShieldCheck for "saved", flame for increase/milestone */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
          milestone
            ? 'bg-[color-mix(in_srgb,var(--sr-warning)_15%,transparent)] text-[var(--sr-warning)]'
            : isSavedState
              ? 'bg-[color-mix(in_srgb,var(--sr-success)_15%,transparent)] text-[var(--sr-success)]'
              : 'bg-[var(--sr-bg-elevated)]',
        )}
        style={{
          height: isLegendary ? 56 : 48,
          width: isLegendary ? 56 : 48,
          ...(!milestone && !isSavedState
            ? streakFlameBadgeStyle(newStreak)
            : undefined),
        }}
        aria-hidden
      >
        {isSavedState ? (
          <ShieldCheck size={26} strokeWidth={2.25} />
        ) : (
          <StreakFlame
            streak={newStreak}
            size={isLegendary ? 30 : 24}
            strokeWidth={2.25}
            sparkle
            embers
            burst
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'sr-streak-pop font-bold tabular-nums leading-none',
              milestone
                ? 'text-[var(--sr-warning)]'
                : isSavedState
                  ? 'text-[var(--sr-success)]'
                  : undefined,
            )}
            style={{
              fontSize: isLegendary ? '2rem' : '1.75rem',
              color: !milestone && !isSavedState ? streakFlameColor(newStreak) : undefined,
            }}
          >
            {newStreak}
          </span>
          <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.streakChainWeeks(newStreak)}
          </span>
        </div>

        {/* Status line — priority: milestone > saved > new record > progress */}
        {milestone ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-warning)]">
            {pl.streakRecapMilestone(milestone)}
          </p>
        ) : isSavedState ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-success)]">
            {pl.streakRecapSaved}
          </p>
        ) : isNewRecord ? (
          <p className="mt-1 sr-text-body-sm font-semibold text-[var(--sr-success)]">
            {pl.streakRecapNewRecord}
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
