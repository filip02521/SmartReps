import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { db } from '@/lib/db'
import type { LocalMaxTest, LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, PrimaryMetric, SetLog } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import {
  builtinProgramLabel,
  builtinSessionToExerciseLog,
  isCompletedBuiltinProgramSession,
  resolveBuiltinProgramForExercise,
  type BuiltinLibraryProgram,
} from '@/lib/builtin-exercise-bridge'
import { formatPrescriptionTarget, formatSetActualDisplay } from '@/lib/custom-prescription-format'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
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

export type ExerciseLastSetRow = {
  setNumber: number
  actualLabel: string
  targetLabel: string
  passed: boolean
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
  /** Date of the session (or builtin max test) that set the primary PR. */
  prDate: string | null
  /** Human context for the PR session, e.g. "Plan · Dzień 3" or "Test max". */
  prSessionLabel: string | null
  /** All-time sum of reps across every set (reps / reps_weight). */
  totalRepsAllTime: number
  /** All-time sum of reps × kg (reps_weight only). */
  totalVolumeKgAllTime: number | null
  /** All-time sum of set durations in seconds (duration_sec). */
  totalDurationSecAllTime: number
  /** Average best-set value per session — work-capacity indicator. */
  avgBestPerSession: number | null
  /** Sessions logged in the last 30 days — recency/frequency. */
  sessionsLast30d: number
  /** Average sessions per week over the tracked span. */
  avgSessionsPerWeek: number | null
  /** Total load per session — volume (reps_weight), total reps (reps), total time (duration). */
  loadPerSession: ExerciseChartPoint[]
  /** Set-by-set breakdown of the most recent session. */
  lastSessionSets: ExerciseLastSetRow[]
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
  weightUnit: 'kg' | 'lb' = 'kg',
): string {
  if (metric === 'duration_sec') {
    return `${set.actual.durationSec ?? 0}s`
  }
  if (metric === 'reps_weight') {
    const reps = set.actual.reps ?? 0
    const w = set.actual.weightKg
    return w != null
      ? `${reps} × ${kgToDisplay(w, weightUnit)} ${weightUnitLabel(weightUnit)}`
      : `${reps} ${pl.repsUnit}`
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

type PrAccum = Pick<
  ExerciseDetailStats,
  'prReps' | 'prDurationSec' | 'prWeightKg' | 'prVolumeKg'
>

function emptyPr(): PrAccum {
  return { prReps: null, prDurationSec: null, prWeightKg: null, prVolumeKg: null }
}

function accumulatePrFromLog(pr: PrAccum, log: ExerciseLog, metric: PrimaryMetric): void {
  for (const set of log.sets) {
    if (set.actual.reps != null) pr.prReps = Math.max(pr.prReps ?? 0, set.actual.reps)
    if (set.actual.durationSec != null) {
      pr.prDurationSec = Math.max(pr.prDurationSec ?? 0, set.actual.durationSec)
    }
    if (set.actual.weightKg != null) {
      pr.prWeightKg = Math.max(pr.prWeightKg ?? 0, set.actual.weightKg)
    }
  }
  if (metric === 'reps_weight') {
    const vol = sessionVolumeKg(log)
    if (vol > 0) pr.prVolumeKg = Math.max(pr.prVolumeKg ?? 0, vol)
  }
}

async function loadBuiltinMaxReps(program: BuiltinLibraryProgram): Promise<number | null> {
  const tests = await db.maxTests.where('program').equals(program).toArray()
  if (tests.length === 0) return null
  return tests.reduce((max, t) => Math.max(max, t.reps), 0)
}

/** Builtin max test with the highest reps (used to date the PR for reps-based builtins). */
async function loadBuiltinMaxTest(program: BuiltinLibraryProgram): Promise<LocalMaxTest | null> {
  const tests = await db.maxTests.where('program').equals(program).toArray()
  if (tests.length === 0) return null
  return tests.reduce((best, t) => (t.reps > best.reps ? t : best))
}

/** Total load for a session — the metric that reflects overall work, not just the peak set. */
function sessionLoad(log: ExerciseLog, metric: PrimaryMetric): number {
  if (metric === 'duration_sec') {
    return log.sets.reduce((sum, set) => sum + (set.actual.durationSec ?? 0), 0)
  }
  if (metric === 'reps_weight') {
    return log.sets.reduce(
      (sum, set) => sum + (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0),
      0,
    )
  }
  return log.sets.reduce((sum, set) => sum + (set.actual.reps ?? 0), 0)
}

function sessionLabel(planName: string, dayNumber: number): string {
  const plan = planName || pl.planDash
  return pl.exerciseDetailPrSessionContext(plan, dayNumber)
}

/** Custom logs for `exerciseId` plus Strong program sessions when the exercise maps. */
export function collectExerciseSessionLogs(
  sessions: LocalWorkoutSession[],
  exercise: Pick<ExerciseDefinition, 'id' | 'name' | 'primaryMetric'>,
): Array<{
  session: LocalWorkoutSession
  log: ExerciseLog
  planName: string
}> {
  const program = resolveBuiltinProgramForExercise(exercise)
  const out: Array<{ session: LocalWorkoutSession; log: ExerciseLog; planName: string }> = []

  for (const session of sessions) {
    if (session.status !== 'completed') continue

    if (isCustomWorkoutSession(session)) {
      const log = session.exerciseLogs?.find((l) => l.exerciseId === exercise.id)
      if (!log || log.sets.length === 0) continue
      out.push({ session, log, planName: '' }) // filled by caller with plan map
      continue
    }

    if (
      program &&
      isCompletedBuiltinProgramSession(session) &&
      session.program === program
    ) {
      const log = builtinSessionToExerciseLog(session, exercise.id)
      if (!log) continue
      out.push({
        session,
        log,
        planName: builtinProgramLabel(program),
      })
    }
  }

  // Chronological order so list sparklines match the detail chart (Dexie toArray is not date-ordered).
  out.sort((a, b) => {
    const aAt = a.session.completedAt ?? a.session.startedAt
    const bAt = b.session.completedAt ?? b.session.startedAt
    return aAt.localeCompare(bAt)
  })

  return out
}

/** Batch summaries for library list (single session scan). */
export async function computeExerciseListSummaries(
  exercises: ExerciseDefinition[],
): Promise<Map<string, ExerciseListSummary>> {
  const valuesById = new Map<string, number[]>()
  const sessionCountById = new Map<string, number>()
  const prById = new Map<string, PrAccum>()

  const sessions = await db.workoutSessions.toArray()

  for (const ex of exercises) {
    const rows = collectExerciseSessionLogs(sessions, ex)
    for (const row of rows) {
      sessionCountById.set(ex.id, (sessionCountById.get(ex.id) ?? 0) + 1)
      const pr = prById.get(ex.id) ?? emptyPr()
      accumulatePrFromLog(pr, row.log, ex.primaryMetric)
      prById.set(ex.id, pr)

      const best = bestSetInLog(row.log, ex.primaryMetric)
      if (best) {
        const arr = valuesById.get(ex.id) ?? []
        arr.push(primarySetValue(best, ex.primaryMetric))
        valuesById.set(ex.id, arr)
      }
    }

    const program = resolveBuiltinProgramForExercise(ex)
    if (program) {
      const maxReps = await loadBuiltinMaxReps(program)
      if (maxReps != null && maxReps > 0) {
        const pr = prById.get(ex.id) ?? emptyPr()
        pr.prReps = Math.max(pr.prReps ?? 0, maxReps)
        prById.set(ex.id, pr)
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
        pr && (sessionCount > 0 || pr.prReps != null)
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
  weightUnit: 'kg' | 'lb' = 'kg',
): Promise<ExerciseDetailStats> {
  const sessions = await db.workoutSessions.toArray()
  const planNames = new Map(
    (await db.customPlans.toArray()).map((p) => [p.id, p.name.trim() || pl.planDash]),
  )

  let sessionCount = 0
  let setCount = 0
  let passedSetCount = 0
  let firstSessionAt: string | null = null
  let lastSessionAt: string | null = null
  const pr = emptyPr()

  let totalRepsAllTime = 0
  let totalVolumeKgAllTime = 0
  let totalDurationSecAllTime = 0
  let primaryPrValue = 0
  let prDate: string | null = null
  let prSessionLabel: string | null = null
  let sessionsLast30d = 0
  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  const chartPoints: ExerciseChartPoint[] = []
  const loadPerSession: ExerciseChartPoint[] = []
  const recentSessions: ExerciseRecentSession[] = []
  const metric = exercise.primaryMetric

  const rows = collectExerciseSessionLogs(sessions, exercise)
  for (const row of rows) {
    const { session, log } = row
    sessionCount += 1
    const at = session.completedAt ?? session.startedAt
    if (!firstSessionAt || at < firstSessionAt) firstSessionAt = at
    if (!lastSessionAt || at > lastSessionAt) lastSessionAt = at
    if (now - new Date(at).getTime() <= thirtyDaysMs) sessionsLast30d += 1

    const planName =
      row.planName ||
      (session.customPlanId && planNames.get(session.customPlanId)) ||
      pl.planDash

    let sessionPassed = 0
    for (const set of log.sets) {
      setCount += 1
      if (set.actual.reps != null) totalRepsAllTime += set.actual.reps
      if (set.actual.durationSec != null) totalDurationSecAllTime += set.actual.durationSec
      if (metric === 'reps_weight') {
        totalVolumeKgAllTime += (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0)
      }
      if (set.passed) {
        passedSetCount += 1
        sessionPassed += 1
      }
    }
    accumulatePrFromLog(pr, log, metric)

    const best = bestSetInLog(log, metric)
    if (best) {
      const value = primarySetValue(best, metric)
      chartPoints.push({
        date: at,
        dateLabel: format(new Date(at), 'd MMM', { locale: plLocale }),
        value,
        tooltipSecondary:
          metric === 'reps_weight' && best.actual.weightKg != null
            ? `${kgToDisplay(best.actual.weightKg, weightUnit)} ${weightUnitLabel(weightUnit)}`
            : null,
      })
      // Track the session that produced the primary peak (used to date the PR).
      if (value > primaryPrValue) {
        primaryPrValue = value
        prDate = at
        prSessionLabel = sessionLabel(planName, session.dayNumber)
      }
    }

    loadPerSession.push({
      date: at,
      dateLabel: format(new Date(at), 'd MMM', { locale: plLocale }),
      value: sessionLoad(log, metric),
      tooltipSecondary: null,
    })

    recentSessions.push({
      sessionId: session.id,
      date: at,
      planName,
      dayNumber: session.dayNumber,
      summary: best ? formatExerciseSetSummary(metric, best) : '—',
      setsPassed: sessionPassed,
      setsTotal: log.sets.length,
    })
  }

  const program = resolveBuiltinProgramForExercise(exercise)
  if (program) {
    const maxTest = await loadBuiltinMaxTest(program)
    if (maxTest && maxTest.reps > 0) {
      pr.prReps = Math.max(pr.prReps ?? 0, maxTest.reps)
      // A builtin max test counts as the reps PR when it exceeds any session set.
      if (metric === 'reps' && maxTest.reps >= primaryPrValue) {
        prDate = maxTest.testedAt
        prSessionLabel = pl.exerciseDetailPrTestLabel
      }
    }
  }

  chartPoints.sort((a, b) => a.date.localeCompare(b.date))
  loadPerSession.sort((a, b) => a.date.localeCompare(b.date))
  recentSessions.sort((a, b) => b.date.localeCompare(a.date))

  const passRatePct =
    setCount > 0 ? Math.round((passedSetCount / setCount) * 100) : null

  const { trend, deltaPct } = computeTrend(chartPoints.map((p) => p.value))

  const bestValues = chartPoints.map((p) => p.value)
  const avgBestPerSession =
    bestValues.length > 0
      ? Math.round(bestValues.reduce((a, b) => a + b, 0) / bestValues.length)
      : null

  let avgSessionsPerWeek: number | null = null
  if (firstSessionAt && lastSessionAt && lastSessionAt !== firstSessionAt) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(lastSessionAt).getTime() - new Date(firstSessionAt).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    )
    avgSessionsPerWeek = Math.round((sessionCount / (days / 7)) * 10) / 10
  }

  // Set-by-set breakdown of the most recent session (recentSessions is desc-sorted).
  const lastRow = recentSessions[0]
  let lastSessionSets: ExerciseLastSetRow[] = []
  if (lastRow) {
    const lastLogRow = rows.find((r) => r.session.id === lastRow.sessionId)
    if (lastLogRow) {
      lastSessionSets = lastLogRow.log.sets
        .slice()
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((set) => ({
          setNumber: set.setNumber,
          actualLabel: formatSetActualDisplay(set.actual, metric, weightUnit),
          targetLabel: formatPrescriptionTarget(set.prescription, metric, weightUnit),
          passed: set.passed,
        }))
    }
  }

  return {
    exercise,
    sessionCount,
    setCount,
    passedSetCount,
    passRatePct,
    firstSessionAt,
    lastSessionAt,
    ...pr,
    prDate,
    prSessionLabel,
    totalRepsAllTime,
    totalVolumeKgAllTime: metric === 'reps_weight' ? totalVolumeKgAllTime : null,
    totalDurationSecAllTime,
    avgBestPerSession,
    sessionsLast30d,
    avgSessionsPerWeek,
    loadPerSession,
    lastSessionSets,
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
  weightUnit: 'kg' | 'lb' = 'kg',
): string {
  const m = stats.exercise.primaryMetric
  if (m === 'duration_sec' && stats.prDurationSec != null) {
    return `${stats.prDurationSec}s`
  }
  if (m === 'reps_weight') {
    const parts: string[] = []
    if (stats.prReps != null) parts.push(`${stats.prReps} ${pl.repsUnit}`)
    if (stats.prWeightKg != null) {
      const disp = kgToDisplay(stats.prWeightKg, weightUnit)
      parts.push(`${disp} ${weightUnitLabel(weightUnit)}`)
    }
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
