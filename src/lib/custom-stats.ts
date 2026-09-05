import { db } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, PrimaryMetric, SetLog } from '@/lib/exercise-model'
import {
  collectExerciseSessionLogs,
  type ExerciseTrend,
} from '@/lib/custom-exercise-stats'
import {
  resolveBuiltinProgramForExercise,
  type BuiltinLibraryProgram,
} from '@/lib/builtin-exercise-bridge'

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

async function loadBuiltinMaxReps(program: BuiltinLibraryProgram): Promise<number | null> {
  const tests = await db.maxTests.where('program').equals(program).toArray()
  if (tests.length === 0) return null
  return tests.reduce((max, t) => Math.max(max, t.reps), 0)
}

export async function computeCustomExercisePrs(): Promise<ExercisePr[]> {
  const exercises = await db.exercises.filter((e) => !e.archived).toArray()
  const sessions = await db.workoutSessions.toArray()

  const results: ExercisePr[] = []

  for (const ex of exercises as ExerciseDefinition[]) {
    let maxReps: number | null = null
    let maxDurationSec: number | null = null
    let maxWeightKg: number | null = null
    let lastSessionAt: string | null = null
    let sessionCount = 0
    const chartValues: number[] = []

    for (const row of collectExerciseSessionLogs(sessions, ex)) {
      const { session, log } = row
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

    const program = resolveBuiltinProgramForExercise(ex)
    if (program) {
      const testMax = await loadBuiltinMaxReps(program)
      if (testMax != null && testMax > 0) {
        maxReps = Math.max(maxReps ?? 0, testMax)
      }
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

export type CustomVolumeStats = {
  volume14d: number
  volumePrev14d: number
  volumeChangePct: number | null
  avgRepsPerSession: number | null
  avgSessionsPerWeek: number | null
  sessionsLast30d: number
}

function sessionTotalVolume(s: { exerciseLogs?: ExerciseLog[]; totalReps?: number }): number {
  if (s.exerciseLogs?.length) {
    return s.exerciseLogs.reduce((sum, log) => {
      return sum + log.sets.reduce((s2, set) => {
        const reps = set.actual.reps ?? 0
        const w = set.actual.weightKg ?? 0
        const dur = set.actual.durationSec ?? 0
        // Volume = reps*weight for weighted; reps for bodyweight; 1 per second for time
        return s2 + (w > 0 ? reps * w : reps > 0 ? reps : dur)
      }, 0)
    }, 0)
  }
  return s.totalReps ?? 0
}

export async function getCustomVolumeStats(): Promise<CustomVolumeStats> {
  const { isCustomWorkoutSession } = await import('@/lib/custom-session-utils')
  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => isCustomWorkoutSession(s) && s.status === 'completed')

  const now = Date.now()
  const windowMs = 14 * 86400000
  let volume14d = 0
  let volumePrev14d = 0
  let sessionsLast30d = 0
  let totalVolume = 0
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const s of sessions) {
    const t = new Date(s.startedAt).getTime()
    const vol = sessionTotalVolume(s)
    totalVolume += vol
    if (t >= now - windowMs) volume14d += vol
    else if (t >= now - 2 * windowMs) volumePrev14d += vol
    if (t >= now - 30 * 86400000) sessionsLast30d++
    const at = s.completedAt ?? s.startedAt
    if (!firstAt || at < firstAt) firstAt = at
    if (!lastAt || at > lastAt) lastAt = at
  }

  const volumeChangePct =
    volumePrev14d > 0 ? Math.round(((volume14d - volumePrev14d) / volumePrev14d) * 100) : null

  const avgRepsPerSession = sessions.length > 0 ? Math.round(totalVolume / sessions.length) : null
  let avgSessionsPerWeek: number | null = null
  if (firstAt && lastAt && sessions.length > 0) {
    const spanDays = Math.max(1, (new Date(lastAt).getTime() - new Date(firstAt).getTime()) / 86400000)
    avgSessionsPerWeek = Math.round((sessions.length / spanDays) * 7 * 10) / 10
  }

  return {
    volume14d,
    volumePrev14d,
    volumeChangePct,
    avgRepsPerSession,
    avgSessionsPerWeek,
    sessionsLast30d,
  }
}

export type CustomSessionChartPoint = {
  date: string
  dateLabel: string
  value: number
  dayNumber: number
}

export async function getCustomSessionChart(): Promise<CustomSessionChartPoint[]> {
  const { format } = await import('date-fns')
  const { pl: plLocale } = await import('date-fns/locale')
  const { isCustomWorkoutSession } = await import('@/lib/custom-session-utils')
  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => isCustomWorkoutSession(s) && s.status === 'completed')

  const points: CustomSessionChartPoint[] = []
  for (const s of sessions) {
    const vol = sessionTotalVolume(s)
    if (vol <= 0) continue
    const at = s.completedAt ?? s.startedAt
    points.push({
      date: at,
      dateLabel: format(new Date(at), 'd MMM', { locale: plLocale }),
      value: vol,
      dayNumber: s.dayNumber,
    })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export type CustomOverviewStats = {
  totalSessions: number
  totalVolume: number
  streakWeeks: number
  exercisesTrained: number
}

export async function getCustomOverviewStats(): Promise<CustomOverviewStats> {
  const { isCustomWorkoutSession } = await import('@/lib/custom-session-utils')
  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => isCustomWorkoutSession(s) && s.status === 'completed')

  let totalVolume = 0
  const exerciseIds = new Set<string>()
  for (const s of sessions) {
    totalVolume += sessionTotalVolume(s)
    if (s.exerciseLogs) {
      for (const log of s.exerciseLogs) exerciseIds.add(log.exerciseId)
    }
  }

  // Streak weeks: count distinct ISO weeks with at least one session
  const weeks = new Set<string>()
  for (const s of sessions) {
    const d = new Date(s.startedAt)
    const year = d.getFullYear()
    const onejan = new Date(year, 0, 1)
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
    weeks.add(`${year}-${week}`)
  }

  return {
    totalSessions: sessions.length,
    totalVolume,
    streakWeeks: weeks.size,
    exercisesTrained: exerciseIds.size,
  }
}
