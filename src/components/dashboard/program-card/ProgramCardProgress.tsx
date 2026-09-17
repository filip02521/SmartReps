import { pl } from '@/i18n/pl'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { CycleDayRail } from '@/components/ui/CycleDayRail'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { programAccentColor } from '@/components/ui/ProgramAccentCard'
import type { Cycle, Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { ProgramStats } from '@/lib/stats-engine'

/** Cycle progress block — one compact "level · day X/Y · pct" caption row
 *  plus the day rail. The rail replaces the old continuous bar (it showed
 *  the same datum); its current day takes the program accent so the card
 *  body keeps program identity after the slimmer chrome. */
export function ProgramCardProgress({
  program,
  cycle,
  progress,
  isTestPending,
  cycleNameShort,
}: {
  program: Program
  cycle: Cycle
  progress: LocalProgramProgress
  isTestPending: boolean
  cycleNameShort: string | null
}) {
  const completedDays = isTestPending
    ? cycle.days.length
    : Math.max(0, progress.currentDay - 1)
  const pct =
    cycle.days.length > 0 ? Math.round((completedDays / cycle.days.length) * 100) : 0

  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="sr-text-caption text-[var(--sr-text-secondary)]">
          {isTestPending
            ? pl.cycleDoneTestLabel
            : pl.homeProgramLevelDay(
                cycleNameShort ?? '',
                progress.currentDay,
                cycle.days.length,
              )}
          {progress.cycleAttempt >= 2 && (
            <>
              {' · '}
              {pl.homeCycleRestart(progress.cycleAttempt)}
            </>
          )}
        </p>
        <p className="shrink-0 sr-text-caption font-semibold tabular-nums text-[var(--sr-text-primary)]">
          {pct}%
        </p>
      </div>

      <CycleDayRail
        accent={programAccentColor(program)}
        totalDays={cycle.days.length}
        days={cycle.days.map((d) => ({
          dayNumber: d.dayNumber,
          status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
        }))}
      />
    </div>
  )
}

/** One thin telemetry line — replaces the old 2×2 stat-tile grid. Same data
 *  (last day, next workout, last-session reps, max-set trend), no tiles and
 *  no inset box: a middot-separated caption row keeps the card compact. */
export function ProgramCardStatsStrip({
  stats,
  showNextWorkout,
}: {
  stats: ProgramStats
  showNextWorkout: boolean
}) {
  const hasContent =
    stats.lastSession ||
    (showNextWorkout && stats.nextWorkoutLabel) ||
    stats.lastTotalReps !== null ||
    stats.maxLastSetTrend.delta !== null
  if (!hasContent) return null

  const items = [
    stats.lastSession && (
      <span key="last">
        {pl.lastWorkout}{' '}
        <span className="font-semibold text-[var(--sr-text-secondary)]">
          {pl.dayDoneCheck(stats.lastSession.dayNumber)}
        </span>
      </span>
    ),
    showNextWorkout && (
      <span key="next">
        {pl.nextWorkout}{' '}
        <span className="font-semibold text-[var(--sr-text-secondary)]">
          {stats.nextWorkoutLabel}
        </span>
      </span>
    ),
    stats.lastTotalReps !== null && (
      <span key="reps">{pl.totalRepsLastSession(stats.lastTotalReps)}</span>
    ),
    stats.maxLastSetTrend.delta !== null && (
      <span key="trend" className="inline-flex items-center gap-1">
        <span>{pl.maxSetTrend}</span>
        <span className="font-semibold tabular-nums text-[var(--sr-text-secondary)]">
          {stats.maxLastSetTrend.current}
        </span>
        <TrendIndicator delta={stats.maxLastSetTrend.delta} />
      </span>
    ),
  ].filter(Boolean)

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sr-text-caption text-[var(--sr-text-muted)]">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {item}
        </span>
      ))}
    </p>
  )
}
