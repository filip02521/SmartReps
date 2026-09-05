import { db } from '@/lib/db'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'

export type CorrelationPoint = {
  /** ISO date of the body weight measurement. */
  date: string
  /** Body weight in kg. */
  weight: number
  /** Performance metric value (max reps or max weight) closest to this date. */
  performance: number
}

export type BodyWeightCorrelation = {
  points: CorrelationPoint[]
  /** Pearson correlation coefficient (-1 to 1); null if insufficient data. */
  correlation: number | null
  /** Trend interpretation. */
  trend: 'positive' | 'negative' | 'neutral'
  /** True if not enough data to compute correlation. */
  insufficientData: boolean
}

/**
 * Compute correlation between body weight changes and workout performance.
 * For each body weight entry, finds the closest workout session (±7 days)
 * and uses the best performance metric from that session.
 *
 * Performance metric:
 * - Builtin sessions: max set (reps)
 * - Custom sessions: max weight×reps volume from exercise logs
 */
export async function getBodyWeightPerformanceCorrelation(): Promise<BodyWeightCorrelation> {
  const entries = (await db.bodyWeight.toArray()).sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )

  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  if (entries.length < 3 || sessions.length < 3) {
    return {
      points: [],
      correlation: null,
      trend: 'neutral',
      insufficientData: true,
    }
  }

  const points: CorrelationPoint[] = []
  const sevenDaysMs = 7 * 86400000

  for (const entry of entries) {
    const entryTime = new Date(entry.measuredAt).getTime()

    // Find closest session within ±7 days
    let bestSession = null as (typeof sessions)[number] | null
    let bestDiff = Infinity
    for (const s of sessions) {
      const sTime = new Date(s.startedAt).getTime()
      const diff = Math.abs(sTime - entryTime)
      if (diff <= sevenDaysMs && diff < bestDiff) {
        bestDiff = diff
        bestSession = s
      }
    }

    if (!bestSession) continue

    // Compute performance metric for this session
    let performance = 0
    if (isCustomWorkoutSession(bestSession) && bestSession.exerciseLogs) {
      // Custom: max volume (weight×reps for weighted, reps for bodyweight, duration for timed)
      for (const log of bestSession.exerciseLogs) {
        for (const set of log.sets) {
          const reps = set.actual.reps ?? 0
          const weight = set.actual.weightKg ?? 0
          const duration = set.actual.durationSec ?? 0
          if (weight > 0) {
            performance = Math.max(performance, reps * weight)
          } else if (reps > 0) {
            performance = Math.max(performance, reps)
          } else if (duration > 0) {
            performance = Math.max(performance, duration)
          }
        }
      }
    } else {
      // Builtin: max set
      if (bestSession.setResults.length) {
        performance = Math.max(...bestSession.setResults.map((s) => s.actual))
      }
    }

    if (performance > 0) {
      points.push({
        date: entry.measuredAt,
        weight: entry.weightKg,
        performance,
      })
    }
  }

  if (points.length < 3) {
    return {
      points: [],
      correlation: null,
      trend: 'neutral',
      insufficientData: true,
    }
  }

  const correlation = pearsonCorrelation(
    points.map((p) => p.weight),
    points.map((p) => p.performance),
  )

  let trend: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (correlation != null) {
    if (correlation >= 0.3) trend = 'positive'
    else if (correlation <= -0.3) trend = 'negative'
  }

  return {
    points,
    correlation: correlation != null ? Math.round(correlation * 100) / 100 : null,
    trend,
    insufficientData: false,
  }
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length
  if (n < 3) return null

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let numerator = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX
    const dy = y[i]! - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  if (denom === 0) return null
  return numerator / denom
}

/** Format correlation for display. */
export function formatCorrelationLabel(
  corr: BodyWeightCorrelation,
  t: {
    bodyWeightCorrelationPositive: (r: number) => string
    bodyWeightCorrelationNegative: (r: number) => string
    bodyWeightCorrelationNeutral: (r: number) => string
    bodyWeightCorrelationInsufficientData: string
  },
): string {
  if (corr.insufficientData || corr.correlation == null) {
    return t.bodyWeightCorrelationInsufficientData
  }
  const r = corr.correlation
  if (corr.trend === 'positive') return t.bodyWeightCorrelationPositive(r)
  if (corr.trend === 'negative') return t.bodyWeightCorrelationNegative(r)
  return t.bodyWeightCorrelationNeutral(r)
}
