import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { NestedStat } from '@/components/ui/NestedStat'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import type {
  CustomPlan,
  ExerciseDefinition,
  PrimaryMetric,
  SetPrescription,
} from '@/lib/exercise-model'
import {
  formatPrescriptionTarget,
  formatSetActualDisplay,
} from '@/lib/custom-prescription-format'
import {
  customSessionPassedSets,
  customSessionTotalDurationSec,
  customSessionTotalReps,
} from '@/lib/custom-session-comparison'
import { sessionTotalSets } from '@/lib/custom-session-stats'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import {
  customSetInsightAria,
  formatCustomSetInsightBadge,
  type CustomSessionInsights,
} from '@/lib/session-summary-insights'
import {
  SessionSummaryHighlights,
  SummaryInsightBadge,
} from '@/components/workout/SessionSummaryHighlights'
import { formatSessionElapsed, sessionCompletedWallClockSec } from '@/lib/session-elapsed'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

type RecapProps = {
  current: LocalWorkoutSession
  previous?: LocalWorkoutSession
  exerciseMap: Map<string, ExerciseDefinition>
  insights?: CustomSessionInsights
  weightUnit?: 'kg' | 'lb'
}

function findPreviousSet(
  previous: LocalWorkoutSession | undefined,
  exerciseId: string,
  setNumber: number,
) {
  const log = previous?.exerciseLogs?.find((l) => l.exerciseId === exerciseId)
  return log?.sets.find((s) => s.setNumber === setNumber)
}

function primaryMetricValue(
  metric: PrimaryMetric,
  set: { actual: { reps?: number; durationSec?: number } },
): number {
  if (metric === 'duration_sec') return set.actual.durationSec ?? 0
  return set.actual.reps ?? 0
}

export function CustomSessionRecap({ current, previous, exerciseMap, insights, weightUnit = 'kg' }: RecapProps) {
  const logs = current.exerciseLogs ?? []
  const totalReps = customSessionTotalReps(current)
  const totalDurationSec = customSessionTotalDurationSec(current)
  const wallClockSec = sessionCompletedWallClockSec(current.startedAt, current.completedAt)
  const prevTotalReps = previous ? customSessionTotalReps(previous) : null
  const totalDelta =
    prevTotalReps != null && prevTotalReps > 0 ? totalReps - prevTotalReps : null
  const { passed, total } = customSessionPassedSets(current)
  const showWall = wallClockSec > 0
  const showSetTime = totalDurationSec > 0
  const statCount = 2 + (showWall ? 1 : 0) + (showSetTime ? 1 : 0)

  // Professional metrics: total volume, exercise count, total sets, avg volume
  const exerciseCount = logs.length
  const allSets = logs.length > 0 ? sessionTotalSets(current) : 0
  let totalVolumeKg = 0
  let hasWeights = false
  for (const log of logs) {
    for (const set of log.sets) {
      const reps = set.actual.reps ?? 0
      const kg = set.actual.weightKg ?? 0
      if (kg > 0) {
        hasWeights = true
        totalVolumeKg += reps * kg
      }
    }
  }
  const avgVolumePerSet = total > 0 && hasWeights ? Math.round(totalVolumeKg / total) : 0
  const totalVolumeDisplay = hasWeights ? kgToDisplay(totalVolumeKg, weightUnit) : 0

  return (
    <>
      {insights && <SessionSummaryHighlights highlights={insights.highlights} />}

      <div
        className={cn(
          'mb-4 grid gap-2',
          // 4 stats → keep 2×2 (avoids orphan on sm:3-col). 3 stats → 2 then 3 on sm+.
          statCount === 4
            ? 'grid-cols-2'
            : statCount >= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2',
        )}
      >
        {showWall ? (
          <NestedStat
            size="lg"
            highlight
            overline={pl.workoutDuration}
            value={formatSessionElapsed(wallClockSec)}
          />
        ) : null}
        {showSetTime ? (
          <NestedStat
            size="lg"
            overline={pl.customWorkoutSetTimeSec}
            value={formatSessionElapsed(totalDurationSec)}
            hint={pl.customSessionDurationTotalHint}
          />
        ) : null}
        <NestedStat
          size="lg"
          highlight={!showWall && !showSetTime}
          overline={pl.totalReps}
          value={totalReps}
          hint={
            totalDelta !== null && totalDelta !== 0
              ? pl.totalRepsDelta(totalDelta)
              : prevTotalReps != null
                ? pl.summaryUnchanged
                : undefined
          }
        />
        <NestedStat
          size="lg"
          overline={pl.setColumn}
          value={`${passed}/${total}`}
          hint={pl.summarySetsPassed}
        />
      </div>

      {/* Professional metrics row — exercise count, total sets, volume */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NestedStat
          size="md"
          overline={pl.summaryExerciseCount}
          value={exerciseCount}
        />
        <NestedStat
          size="md"
          overline={pl.summaryTotalSets}
          value={allSets}
        />
        {hasWeights ? (
          <NestedStat
            size="md"
            overline={pl.summaryTotalVolume}
            value={totalVolumeDisplay}
            hint={weightUnitLabel(weightUnit)}
          />
        ) : null}
      </div>

      {hasWeights && avgVolumePerSet > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <NestedStat
            size="md"
            overline={pl.summaryAvgVolume}
            value={kgToDisplay(avgVolumePerSet, weightUnit)}
            hint={weightUnitLabel(weightUnit)}
          />
        </div>
      )}

      <h3 className="mb-2 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
        {pl.summarySectionSets}
      </h3>

      {logs.map((log) => {
        const def = exerciseMap.get(log.exerciseId)
        const metric: PrimaryMetric = def?.primaryMetric ?? 'reps'
        const name = def?.name ?? pl.planDash
        return (
          <Card key={`${log.exerciseId}-${log.order}`} className="mb-3 overflow-x-auto p-4 transition-colors hover:border-[var(--sr-border-strong)]">
            <p className="mb-3 font-semibold text-[var(--sr-text-primary)]">{name}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left sr-text-overline text-[var(--sr-text-muted)]">
                  <th className="pb-2 font-semibold">{pl.setColumn}</th>
                  <th className="pb-2 font-semibold">{pl.targetColumn}</th>
                  <th className="pb-2 font-semibold">{pl.youColumn}</th>
                  <th className="hidden pb-2 font-semibold sm:table-cell">{pl.prevColumn}</th>
                </tr>
              </thead>
              <tbody>
                {log.sets.map((set, idx) => {
                  const prevSet = findPreviousSet(previous, log.exerciseId, set.setNumber)
                  const diff =
                    prevSet != null
                      ? primaryMetricValue(metric, set) - primaryMetricValue(metric, prevSet)
                      : null
                  const setInsight = insights?.setInsights.get(`${log.exerciseId}:${set.setNumber}`)
                  const badge = formatCustomSetInsightBadge(setInsight)
                  const ariaLabel = customSetInsightAria(setInsight, metric, set)
                  return (
                    <tr
                      key={set.setNumber}
                      className={
                        idx % 2 === 0
                          ? 'border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/40'
                          : 'border-t border-[var(--sr-border-subtle)]'
                      }
                    >
                      <td className="py-2 font-medium text-[var(--sr-text-secondary)]">
                        {set.setNumber}
                      </td>
                      <td className="py-2 tabular-nums text-[var(--sr-text-secondary)]">
                        {formatPrescriptionTarget(set.prescription, metric, weightUnit)}
                      </td>
                      <td
                        className={`py-2 text-base font-semibold tabular-nums ${
                          set.passed
                            ? 'text-[var(--sr-text-primary)]'
                            : 'text-[var(--sr-error)]'
                        }`}
                      >
                        <span
                          className="inline-flex flex-wrap items-center gap-1.5"
                          aria-label={ariaLabel ?? undefined}
                        >
                          {formatSetActualDisplay(set.actual, metric, weightUnit)}
                          {badge && setInsight?.kind === 'pr' && (
                            <SummaryInsightBadge tone="pr">{badge}</SummaryInsightBadge>
                          )}
                          {badge && setInsight?.kind === 'improved' && (
                            <SummaryInsightBadge tone="progress">{badge}</SummaryInsightBadge>
                          )}
                          {badge && setInsight?.kind === 'down' && (
                            <SummaryInsightBadge tone="down">{badge}</SummaryInsightBadge>
                          )}
                        </span>
                      </td>
                      <td className="hidden py-2 tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                        {prevSet ? (
                          <span className="inline-flex items-center gap-1">
                            {formatSetActualDisplay(prevSet.actual, metric, weightUnit)}
                            <TrendIndicator delta={diff} />
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      })}
    </>
  )
}

type DiffEntry = {
  dayNumber: number
  exerciseOrder: number
  before: SetPrescription[]
  after: SetPrescription[]
}

function formatSetsLine(sets: SetPrescription[], metric: PrimaryMetric, weightUnit: 'kg' | 'lb' = 'kg'): string {
  if (sets.length === 0) return '—'
  return sets.map((s) => formatPrescriptionTarget(s, metric, weightUnit)).join(' · ')
}

function findExerciseMeta(
  plan: CustomPlan | null,
  exerciseMap: Map<string, ExerciseDefinition>,
  dayNumber: number,
  exerciseOrder: number,
): { name: string; metric: PrimaryMetric } {
  const day = plan?.days.find((d) => d.dayNumber === dayNumber)
  const planned = day?.exercises.find((e) => e.order === exerciseOrder)
  const def = planned ? exerciseMap.get(planned.exerciseId) : undefined
  return {
    name: def?.name ?? pl.planEllipsis,
    metric: def?.primaryMetric ?? 'reps',
  }
}

export function CustomProgressionDiffList({
  diffJson,
  planId,
}: {
  diffJson: string
  planId?: string
}) {
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Map<string, ExerciseDefinition>>(new Map())

  useEffect(() => {
    if (!planId) return
    void (async () => {
      const [loadedPlan, exercises] = await Promise.all([
        db.customPlans.get(planId),
        db.exercises.toArray(),
      ])
      setPlan(loadedPlan ?? null)
      const map = new Map<string, ExerciseDefinition>()
      for (const ex of exercises) map.set(ex.id, ex)
      setExerciseMap(map)
    })()
  }, [planId])

  let entries: DiffEntry[]
  try {
    entries = JSON.parse(diffJson) as DiffEntry[]
  } catch {
    return null
  }
  if (entries.length === 0) return null

  const ready = planId == null || plan != null

  return (
    <Card className="mt-4 border border-[var(--sr-brand-primary)] p-4">
      <p className="font-semibold text-[var(--sr-text-primary)]">{pl.customProgressionAppliedTitle}</p>
      <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.customProgressionAppliedHint}</p>
      {!ready ? (
        <p className="mt-3 text-sm text-[var(--sr-text-muted)]">{pl.loading}</p>
      ) : (
      <ul className="mt-3 space-y-2 text-sm text-[var(--sr-text-secondary)]">
        {entries.slice(0, 8).map((entry) => {
          const { name, metric } = findExerciseMeta(
            plan,
            exerciseMap,
            entry.dayNumber,
            entry.exerciseOrder,
          )
          return (
            <li key={`${entry.dayNumber}-${entry.exerciseOrder}`}>
              {pl.customProgressionDiffLine(
                entry.dayNumber,
                name,
                formatSetsLine(entry.before, metric),
                formatSetsLine(entry.after, metric),
              )}
            </li>
          )
        })}
        {entries.length > 8 && (
          <li className="text-[var(--sr-text-muted)]">
            {pl.customProgressionDiffMore(entries.length - 8)}
          </li>
        )}
      </ul>
      )}
    </Card>
  )
}
