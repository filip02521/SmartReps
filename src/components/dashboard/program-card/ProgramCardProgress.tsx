import { pl } from '@/i18n/pl'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { CycleDayRail } from '@/components/ui/CycleDayRail'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import type { Cycle, Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { ProgramStats } from '@/lib/stats-engine'

/** Cycle progress block — "level · day X/Y" line, % bar, day rail. */
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
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
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
        <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
          {pct}%
        </p>
      </div>

      {/* Progress bar — accent-colored, subtle */}
      <div
        className="mb-2.5 h-2 overflow-hidden rounded-full bg-[var(--sr-bg-surface)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{
            width: `${pct}%`,
            background:
              program === 'pushups'
                ? 'var(--sr-pushups-accent)'
                : program === 'pullups'
                  ? 'var(--sr-pullups-accent)'
                  : 'var(--sr-squats-accent)',
          }}
        />
      </div>

      <CycleDayRail
        totalDays={cycle.days.length}
        days={cycle.days.map((d) => ({
          dayNumber: d.dayNumber,
          status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
        }))}
      />
    </div>
  )
}

/** One thin telemetry row — replaces the old 2×2 stat-tile grid. Same data
 *  (last day, next workout, last-session reps, max-set trend), no tiles:
 *  the card stays under 4 stacked blocks. */
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

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
      {stats.lastSession && (
        <span>
          {pl.lastWorkout}{' '}
          <span className="font-semibold text-[var(--sr-text-primary)]">
            {pl.dayDoneCheck(stats.lastSession.dayNumber)}
          </span>
        </span>
      )}
      {showNextWorkout && (
        <span>
          {pl.nextWorkout}{' '}
          <span className="font-semibold text-[var(--sr-text-primary)]">
            {stats.nextWorkoutLabel}
          </span>
        </span>
      )}
      {stats.lastTotalReps !== null && (
        <span>{pl.totalRepsLastSession(stats.lastTotalReps)}</span>
      )}
      {stats.maxLastSetTrend.delta !== null && (
        <span className="inline-flex items-center gap-1.5">
          <span>{pl.maxSetTrend}</span>
          <span className="font-semibold tabular-nums text-[var(--sr-text-primary)]">
            {stats.maxLastSetTrend.current}
          </span>
          <TrendIndicator delta={stats.maxLastSetTrend.delta} />
        </span>
      )}
    </div>
  )
}
