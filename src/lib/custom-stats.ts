import { db } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, PrimaryMetric, SetLog } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import type { ExerciseTrend } from '@/lib/custom-exercise-stats'

export type ExercisePr = {
  exerciseId: string
  name: string
  maxReps: number | null
  maxDurationSec: number | null
  maxWeightKg: number | null
  lastSessionAt: string | null
  sessionCount: number
  sparkline: number[]
  trend: ExerciseTrend
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

function computeTrend(values: number[]): ExerciseTrend {
  if (values.length < 4) return null
  const recent = values.slice(-3)
  const previous = values.slice(-6, -3)
  if (previous.length === 0) return null
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length
  if (prevAvg === 0) return recentAvg > 0 ? 'up' : null
  const deltaPct = Math.round(((recentAvg - prevAvg) / prevAvg) * 100)
  if (Math.abs(deltaPct) < 3) return 'flat'
  return deltaPct > 0 ? 'up' : 'down'
}

export async function computeCustomExercisePrs(): Promise<ExercisePr[]> {
  const exercises = await db.exercises.filter((e) => !e.archived).toArray()
  const sessions = (await db.workoutSessions.toArray()).filter(
    (s) => isCustomWorkoutSession(s) && s.status === 'completed',
  )

  const results: ExercisePr[] = []

  for (const ex of exercises as ExerciseDefinition[]) {
    let maxReps: number | null = null
    let maxDurationSec: number | null = null
    let maxWeightKg: number | null = null
    let lastSessionAt: string | null = null
    let sessionCount = 0
    const chartValues: number[] = []

    for (const session of sessions) {
      const log = session.exerciseLogs?.find((l) => l.exerciseId === ex.id)
      if (!log || log.sets.length === 0) continue
      sessionCount += 1
      const at = session.completedAt ?? session.startedAt
      if (!lastSessionAt || at > lastSessionAt) lastSessionAt = at
      for (const set of log.sets) {
        if (set.actual.reps != null) {
          maxReps = Math.max(maxReps ?? 0, set.actual.reps)
        }
        if (set.actual.durationSec != null) {
          maxDurationSec = Math.max(maxDurationSec ?? 0, set.actual.durationSec)
        }
        if (set.actual.weightKg != null) {
          maxWeightKg = Math.max(maxWeightKg ?? 0, set.actual.weightKg)
        }
      }
      const best = bestSetInLog(log, ex.primaryMetric)
      if (best) chartValues.push(primarySetValue(best, ex.primaryMetric))
    }

    const hasRecord =
      maxReps != null || maxDurationSec != null || maxWeightKg != null
    if (!hasRecord) continue

    results.push({
      exerciseId: ex.id,
      name: ex.name,
      maxReps,
      maxDurationSec,
      maxWeightKg,
      lastSessionAt,
      sessionCount,
      sparkline: chartValues.slice(-8),
      trend: computeTrend(chartValues),
    })
  }

  return results.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}
