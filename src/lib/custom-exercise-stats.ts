import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, PrimaryMetric, SetLog } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { pl } from '@/i18n/pl'

export type ExerciseChartPoint = {
  date: string
  dateLabel: string
  value: number
  tooltipSecondary: string | null
}

export type ExerciseRecentSession = {
  sessionId: string
  date: string
  planName: string
  dayNumber: number
  summary: string
  setsPassed: number
  setsTotal: number
}

export type ExerciseTrend = 'up' | 'down' | 'flat' | null

export type ExerciseDetailStats = {
  exercise: ExerciseDefinition
  sessionCount: number
  setCount: number
  passedSetCount: number
  passRatePct: number | null
  firstSessionAt: string | null
  lastSessionAt: string | null
  prReps: number | null
  prDurationSec: number | null
  prWeightKg: number | null
  prVolumeKg: number | null
  chartPoints: ExerciseChartPoint[]
  trend: ExerciseTrend
  trendDeltaPct: number | null
  recentSessions: ExerciseRecentSession[]
}

function bestSetInLog(log: ExerciseLog, metric: PrimaryMetric): SetLog | null {
  if (log.sets.length === 0) return null
  return log.sets.reduce((best, set) => {
    const v = primarySetValue(set, metric)
    const bestV = primarySetValue(best, metric)
    return v > bestV ? set : best
  })
}

function primarySetValue(set: SetLog, metric: PrimaryMetric): number {
  if (metric === 'duration_sec') return set.actual.durationSec ?? 0
  return set.actual.reps ?? 0
}

function sessionVolumeKg(log: ExerciseLog): number {
  return log.sets.reduce(
    (sum, set) => sum + (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0),
    0,
  )
}

export function formatExerciseSetSummary(
  metric: PrimaryMetric,
  set: SetLog,
): string {
  if (metric === 'duration_sec') {
    return `${set.actual.durationSec ?? 0}s`
  }
  if (metric === 'reps_weight') {
    const reps = set.actual.reps ?? 0
    const w = set.actual.weightKg
    return w != null ? `${reps} × ${w} kg` : `${reps} ${pl.repsUnit}`
  }
  return `${set.actual.reps ?? 0} ${pl.repsUnit}`
}

function computeTrend(values: number[]): { trend: ExerciseTrend; deltaPct: number | null } {
  if (values.length < 4) return { trend: null, deltaPct: null }
  const recent = values.slice(-3)
  const previous = values.slice(-6, -3)
  if (previous.length === 0) return { trend: null, deltaPct: null }
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length
  if (prevAvg === 0) return { trend: recentAvg > 0 ? 'up' : null, deltaPct: null }
  const deltaPct = Math.round(((recentAvg - prevAvg) / prevAvg) * 100)
  if (Math.abs(deltaPct) < 3) return { trend: 'flat', deltaPct }
  return { trend: deltaPct > 0 ? 'up' : 'down', deltaPct }
}

export type ExerciseListSummary = {
  sessionCount: number
  prLabel: string | null
  sparkline: number[]
  trend: ExerciseTrend
}

/** Batch summaries for library list (single session scan). */
export async function computeExerciseListSummaries(
  exercises: ExerciseDefinition[],
): Promise<Map<string, ExerciseListSummary>> {
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const valuesById = new Map<string, number[]>()
  const sessionCountById = new Map<string, number>()
  const prById = new Map<
    string,
    Pick<ExerciseDetailStats, 'prReps' | 'prDurationSec' | 'prWeightKg' | 'prVolumeKg'>
  >()

  const sessions = (await db.workoutSessions.toArray()).filter(
    (s) => isCustomWorkoutSession(s) && s.status === 'completed',
  )

  for (const session of sessions) {
    for (const log of session.exerciseLogs ?? []) {
      const ex = exById.get(log.exerciseId)
      if (!ex || log.sets.length === 0) continue

      sessionCountById.set(log.exerciseId, (sessionCountById.get(log.exerciseId) ?? 0) + 1)

      const pr = prById.get(log.exerciseId) ?? {
        prReps: null,
        prDurationSec: null,
        prWeightKg: null,
        prVolumeKg: null,
      }
      for (const set of log.sets) {
        if (set.actual.reps != null) pr.prReps = Math.max(pr.prReps ?? 0, set.actual.reps)
        if (set.actual.durationSec != null) {
          pr.prDurationSec = Math.max(pr.prDurationSec ?? 0, set.actual.durationSec)
        }
        if (set.actual.weightKg != null) {
          pr.prWeightKg = Math.max(pr.prWeightKg ?? 0, set.actual.weightKg)
        }
      }
      if (ex.primaryMetric === 'reps_weight') {
        const vol = sessionVolumeKg(log)
        if (vol > 0) pr.prVolumeKg = Math.max(pr.prVolumeKg ?? 0, vol)
      }
      prById.set(log.exerciseId, pr)

      const best = bestSetInLog(log, ex.primaryMetric)
      if (best) {
        const arr = valuesById.get(log.exerciseId) ?? []
        arr.push(primarySetValue(best, ex.primaryMetric))
        valuesById.set(log.exerciseId, arr)
      }
    }
  }

  const out = new Map<string, ExerciseListSummary>()
  for (const ex of exercises) {
    const values = valuesById.get(ex.id) ?? []
    const pr = prById.get(ex.id)
    const sessionCount = sessionCountById.get(ex.id) ?? 0
    const { trend } = computeTrend(values)
    out.set(ex.id, {
      sessionCount,
      sparkline: values.slice(-8),
      trend,
      prLabel:
        pr && sessionCount > 0
          ? exercisePrDisplay({
              exercise: ex,
              ...pr,
            })
          : null,
    })
  }
  return out
}

export async function computeExerciseDetailStats(
  exercise: ExerciseDefinition,
): Promise<ExerciseDetailStats> {
  const sessions = (await db.workoutSessions.toArray()).filter(
    (s) => isCustomWorkoutSession(s) && s.status === 'completed',
  )
  const planNames = new Map(
    (await db.customPlans.toArray()).map((p) => [p.id, p.name.trim() || pl.planDash]),
  )

  let sessionCount = 0
  let setCount = 0
  let passedSetCount = 0
  let firstSessionAt: string | null = null
  let lastSessionAt: string | null = null
  let prReps: number | null = null
  let prDurationSec: number | null = null
  let prWeightKg: number | null = null
  let prVolumeKg: number | null = null

  const chartPoints: ExerciseChartPoint[] = []
  const recentSessions: ExerciseRecentSession[] = []

  const metric = exercise.primaryMetric

  for (const session of sessions) {
    const log = session.exerciseLogs?.find((l) => l.exerciseId === exercise.id)
    if (!log || log.sets.length === 0) continue

    sessionCount += 1
    const at = session.completedAt ?? session.startedAt
    if (!firstSessionAt || at < firstSessionAt) firstSessionAt = at
    if (!lastSessionAt || at > lastSessionAt) lastSessionAt = at

    let sessionPassed = 0
    for (const set of log.sets) {
      setCount += 1
      if (set.passed) {
        passedSetCount += 1
        sessionPassed += 1
      }
      if (set.actual.reps != null) prReps = Math.max(prReps ?? 0, set.actual.reps)
      if (set.actual.durationSec != null) {
        prDurationSec = Math.max(prDurationSec ?? 0, set.actual.durationSec)
      }
      if (set.actual.weightKg != null) {
        prWeightKg = Math.max(prWeightKg ?? 0, set.actual.weightKg)
      }
    }

    if (metric === 'reps_weight') {
      const vol = sessionVolumeKg(log)
      if (vol > 0) prVolumeKg = Math.max(prVolumeKg ?? 0, vol)
    }

    const best = bestSetInLog(log, metric)
    if (best) {
      const value = primarySetValue(best, metric)
      chartPoints.push({
        date: at,
        dateLabel: format(new Date(at), 'd MMM', { locale: plLocale }),
        value,
        tooltipSecondary:
          metric === 'reps_weight' && best.actual.weightKg != null
            ? `${best.actual.weightKg} kg`
            : null,
      })
    }

    recentSessions.push({
      sessionId: session.id,
      date: at,
      planName:
        (session.customPlanId && planNames.get(session.customPlanId)) || pl.planDash,
      dayNumber: session.dayNumber,
      summary: best ? formatExerciseSetSummary(metric, best) : '—',
      setsPassed: sessionPassed,
      setsTotal: log.sets.length,
    })
  }

  chartPoints.sort((a, b) => a.date.localeCompare(b.date))
  recentSessions.sort((a, b) => b.date.localeCompare(a.date))

  const passRatePct =
    setCount > 0 ? Math.round((passedSetCount / setCount) * 100) : null

  const { trend, deltaPct } = computeTrend(chartPoints.map((p) => p.value))

  return {
    exercise,
    sessionCount,
    setCount,
    passedSetCount,
    passRatePct,
    firstSessionAt,
    lastSessionAt,
    prReps,
    prDurationSec,
    prWeightKg,
    prVolumeKg,
    chartPoints,
    trend,
    trendDeltaPct: deltaPct,
    recentSessions: recentSessions.slice(0, 8),
  }
}

export function exercisePrDisplay(
  stats: Pick<
    ExerciseDetailStats,
    'exercise' | 'prReps' | 'prDurationSec' | 'prWeightKg' | 'prVolumeKg'
  >,
): string {
  const m = stats.exercise.primaryMetric
  if (m === 'duration_sec' && stats.prDurationSec != null) {
    return `${stats.prDurationSec}s`
  }
  if (m === 'reps_weight') {
    const parts: string[] = []
    if (stats.prReps != null) parts.push(`${stats.prReps} ${pl.repsUnit}`)
    if (stats.prWeightKg != null) parts.push(`${stats.prWeightKg} kg`)
    if (stats.prVolumeKg != null && stats.prVolumeKg > 0) {
      parts.push(pl.exerciseDetailVolumeShort(Math.round(stats.prVolumeKg)))
    }
    return parts.join(' · ') || '—'
  }
  if (stats.prReps != null) return `${stats.prReps} ${pl.repsUnit}`
  return '—'
}

export function collectExerciseLogsFromSessions(
  sessions: LocalWorkoutSession[],
  exerciseId: string,
): ExerciseLog[] {
  const logs: ExerciseLog[] = []
  for (const s of sessions) {
    const log = s.exerciseLogs?.find((l) => l.exerciseId === exerciseId)
    if (log) logs.push(log)
  }
  return logs
}
