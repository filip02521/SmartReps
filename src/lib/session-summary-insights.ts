import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, PrimaryMetric, SetLog } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'
import { formatExerciseSetSummary } from '@/lib/custom-exercise-stats'
import { formatSetActualDisplay } from '@/lib/custom-prescription-format'

export type SetInsightKind = 'pr' | 'improved' | 'unchanged' | 'down' | 'failed' | 'none'

export type SessionHighlight = {
  id: string
  tone: 'pr' | 'progress'
  label: string
  value: string
}

export type SetInsight = {
  kind: SetInsightKind
  deltaVsPrevious: number | null
}

export type SessionInsightsSummary = {
  highlights: SessionHighlight[]
  prCount: number
  progressCount: number
}

export type BuiltinSessionInsights = SessionInsightsSummary & {
  setInsights: Map<number, SetInsight>
}

export type CustomSessionInsights = SessionInsightsSummary & {
  setInsights: Map<string, SetInsight>
}

function primarySetValue(set: SetLog, metric: PrimaryMetric): number {
  if (metric === 'duration_sec') return set.actual.durationSec ?? 0
  if (metric === 'reps_weight') {
    return (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0)
  }
  return set.actual.reps ?? 0
}

function logVolumeKg(log: ExerciseLog): number {
  return log.sets.reduce(
    (sum, set) => sum + (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0),
    0,
  )
}

function resolveSetInsight(
  passed: boolean,
  isPr: boolean,
  deltaVsPrevious: number | null,
): SetInsight {
  if (!passed) return { kind: 'failed', deltaVsPrevious }
  if (isPr) return { kind: 'pr', deltaVsPrevious }
  if (deltaVsPrevious === null) return { kind: 'none', deltaVsPrevious }
  if (deltaVsPrevious > 0) return { kind: 'improved', deltaVsPrevious }
  if (deltaVsPrevious < 0) return { kind: 'down', deltaVsPrevious }
  return { kind: 'unchanged', deltaVsPrevious }
}

export function computeBuiltinSessionInsights(params: {
  current: LocalWorkoutSession
  previous?: LocalWorkoutSession
  historicalSessions: LocalWorkoutSession[]
}): BuiltinSessionInsights {
  const { current, previous, historicalSessions } = params
  const rows = current.setResults
  const totalReps = current.totalReps ?? rows.reduce((sum, row) => sum + row.actual, 0)
  const prior = historicalSessions.filter((s) => s.id !== current.id)

  const sameDayPrior = prior.filter((s) => s.dayNumber === current.dayNumber)
  const priorTotals = sameDayPrior.map(
    (s) => s.totalReps ?? s.setResults.reduce((sum, row) => sum + row.actual, 0),
  )
  const sessionTotalPr =
    priorTotals.length > 0 ? totalReps > Math.max(...priorTotals) : false

  const passedRows = rows.filter((r) => r.passed)
  const currentBestSet =
    passedRows.length > 0 ? Math.max(...passedRows.map((r) => r.actual)) : 0
  const priorBestSets = prior.flatMap((s) =>
    s.setResults.filter((r) => r.passed).map((r) => r.actual),
  )
  const globalBestSetPr =
    currentBestSet > 0 &&
    priorBestSets.length > 0 &&
    currentBestSet > Math.max(...priorBestSets)

  const setInsights = new Map<number, SetInsight>()
  let prCount = 0
  let progressCount = 0

  for (const row of rows) {
    const prev = previous?.setResults.find((p) => p.setNumber === row.setNumber)
    const delta = prev ? row.actual - prev.actual : null

    const historicalSameSet = sameDayPrior.flatMap((s) =>
      s.setResults
        .filter((r) => r.setNumber === row.setNumber && r.passed)
        .map((r) => r.actual),
    )
    const setPr =
      row.passed &&
      historicalSameSet.length > 0 &&
      row.actual > Math.max(...historicalSameSet)

    const insight = resolveSetInsight(row.passed, setPr, delta)
    setInsights.set(row.setNumber, insight)
    if (insight.kind === 'pr') prCount += 1
    if (insight.kind === 'improved') progressCount += 1
  }

  const highlights: SessionHighlight[] = []
  if (sessionTotalPr) {
    prCount += 1
    highlights.push({
      id: 'session-total',
      tone: 'pr',
      label: pl.summaryHighlightSessionTotalPr,
      value: `${totalReps} ${pl.repsUnit}`,
    })
  }

  if (globalBestSetPr && currentBestSet > 0) {
    const bestRow = passedRows.find((r) => r.actual === currentBestSet)
    if (bestRow && !highlights.some((h) => h.id === 'best-set')) {
      highlights.push({
        id: 'best-set',
        tone: 'pr',
        label: pl.summaryHighlightBestSetPr(bestRow.setNumber),
        value: `${bestRow.actual} ${pl.repsUnit}`,
      })
    }
  }

  return { highlights, setInsights, prCount, progressCount }
}

export function computeCustomSessionInsights(params: {
  current: LocalWorkoutSession
  previous?: LocalWorkoutSession
  exerciseMap: Map<string, ExerciseDefinition>
  historicalSessions: LocalWorkoutSession[]
}): CustomSessionInsights {
  const { current, previous, exerciseMap, historicalSessions } = params
  const prior = historicalSessions.filter((s) => s.id !== current.id)
  const logs = current.exerciseLogs ?? []

  const setInsights = new Map<string, SetInsight>()
  const highlights: SessionHighlight[] = []

  for (const log of logs) {
    const def = exerciseMap.get(log.exerciseId)
    const metric: PrimaryMetric = def?.primaryMetric ?? 'reps'
    const name = def?.name ?? pl.planDash

    const historicalValues: number[] = []
    const historicalVolumes: number[] = []
    for (const session of prior) {
      const histLog = session.exerciseLogs?.find((l) => l.exerciseId === log.exerciseId)
      if (!histLog) continue
      for (const set of histLog.sets) {
        if (!set.passed) continue
        historicalValues.push(primarySetValue(set, metric))
      }
      if (metric === 'reps_weight') {
        const vol = logVolumeKg(histLog)
        if (vol > 0) historicalVolumes.push(vol)
      }
    }

    let exerciseBest = 0
    let exerciseBestSet: SetLog | null = null
    for (const set of log.sets) {
      if (!set.passed) continue
      const value = primarySetValue(set, metric)
      if (value > exerciseBest) {
        exerciseBest = value
        exerciseBestSet = set
      }
    }

    const exerciseSetPr =
      exerciseBestSet != null &&
      historicalValues.length > 0 &&
      exerciseBest > Math.max(...historicalValues)

    if (exerciseSetPr && exerciseBestSet) {
      highlights.push({
        id: `ex-pr-${log.exerciseId}`,
        tone: 'pr',
        label: pl.summaryHighlightExercisePr(name),
        value: formatExerciseSetSummary(metric, exerciseBestSet),
      })
    }

    if (metric === 'reps_weight') {
      const volume = logVolumeKg(log)
      const volumePr =
        volume > 0 &&
        historicalVolumes.length > 0 &&
        volume > Math.max(...historicalVolumes)
      if (volumePr) {
        highlights.push({
          id: `vol-pr-${log.exerciseId}`,
          tone: 'pr',
          label: pl.summaryHighlightVolumePr(name),
          value: pl.exerciseDetailVolumeShort(Math.round(volume)),
        })
      }
    }

    for (const set of log.sets) {
      const prevSet = previous?.exerciseLogs
        ?.find((l) => l.exerciseId === log.exerciseId)
        ?.sets.find((s) => s.setNumber === set.setNumber)
      const delta =
        prevSet != null
          ? primarySetValue(set, metric) - primarySetValue(prevSet, metric)
          : null

      const value = primarySetValue(set, metric)
      const setPr =
        set.passed && historicalValues.length > 0 && value > Math.max(...historicalValues)

      const insight = resolveSetInsight(set.passed, setPr, delta)
      setInsights.set(`${log.exerciseId}:${set.setNumber}`, insight)
    }
  }

  const prCount =
    [...setInsights.values()].filter((i) => i.kind === 'pr').length +
    highlights.filter((h) => h.id.startsWith('vol-pr')).length
  const progressCount = [...setInsights.values()].filter((i) => i.kind === 'improved').length

  return {
    highlights: highlights.slice(0, 5),
    setInsights,
    prCount,
    progressCount,
  }
}

export function formatBuiltinSetInsightBadge(insight: SetInsight | undefined): string | null {
  if (!insight) return null
  if (insight.kind === 'pr') return pl.summarySetBadgePr
  if (insight.kind === 'improved' && insight.deltaVsPrevious != null) {
    return pl.summarySetBadgeImproved(insight.deltaVsPrevious)
  }
  return null
}

export function formatCustomSetInsightBadge(insight: SetInsight | undefined): string | null {
  if (!insight) return null
  if (insight.kind === 'pr') return pl.summarySetBadgePr
  if (insight.kind === 'improved' && insight.deltaVsPrevious != null) {
    return pl.summarySetBadgeImproved(insight.deltaVsPrevious)
  }
  if (insight.kind === 'down' && insight.deltaVsPrevious != null) {
    return pl.summarySetBadgeDown(insight.deltaVsPrevious)
  }
  return null
}

export function customSetInsightAria(
  insight: SetInsight | undefined,
  metric: PrimaryMetric,
  set: SetLog,
): string | null {
  if (!insight || insight.kind === 'none' || insight.kind === 'unchanged') return null
  const value = formatSetActualDisplay(set.actual, metric)
  if (insight.kind === 'pr') return pl.summarySetInsightPr(value)
  if (insight.kind === 'improved' && insight.deltaVsPrevious != null) {
    return pl.summarySetInsightImproved(value, insight.deltaVsPrevious)
  }
  if (insight.kind === 'down' && insight.deltaVsPrevious != null) {
    return pl.summarySetInsightDown(value, insight.deltaVsPrevious)
  }
  if (insight.kind === 'failed') return pl.summarySetInsightFailed(value)
  return null
}
