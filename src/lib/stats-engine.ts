import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { db, type LocalWorkoutSession, type LocalProgramProgress } from '@/lib/db'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import type { SetTarget } from '@/data/plans/types'
import { getCompletedDaysInCycle } from '@/lib/cycle-progress'
import { pl } from '@/i18n/pl'

export type ProgramStats = {
  lastSession: LocalWorkoutSession | undefined
  nextWorkoutLabel: string
  lastTotalReps: number | null
  maxLastSetTrend: { current: number; previous: number | null; delta: number | null }
  passedSessionCount: number
  totalRepsAllTime: number
  streakWeeks: number
  maxTestRecord: number | null
  completedDaysInCycle: number
  cycleDaysTotal: number
}

function getLastSetActual(session: LocalWorkoutSession): number | null {
  const last = session.setResults[session.setResults.length - 1]
  return last?.actual ?? null
}

function getLastSetTarget(daySets: SetTarget[] | undefined): number | null {
  if (!daySets?.length) return null
  const last = daySets[daySets.length - 1]
  if (last.kind === 'max') return last.minReps
  return last.reps
}

function getMaxSetTrend(passed: LocalWorkoutSession[]): {
  current: number
  previous: number | null
  delta: number | null
} {
  if (!passed.length) {
    return { current: 0, previous: null, delta: null }
  }

  const lastSession = passed[0]
  const sameDaySessions = passed
    .filter((s) => s.dayNumber === lastSession.dayNumber)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const currentSession = sameDaySessions[0]
  const previousSession = sameDaySessions[1]

  const current = currentSession ? getLastSetActual(currentSession) : null
  const previous = previousSession ? getLastSetActual(previousSession) : null

  return {
    current: current ?? 0,
    previous,
    delta: current !== null && previous !== null ? current - previous : null,
  }
}

export async function getProgramStats(
  program: Program,
  progress: LocalProgramProgress,
): Promise<ProgramStats> {
  const sessions = await db.workoutSessions.where('program').equals(program).toArray()
  const passed = sessions.filter((s) => s.status === 'completed' && s.passed)
  passed.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const lastSession = passed[0]
  const cycle = getCycleById(progress.cycleId)
  const day = cycle?.days.find((d) => d.dayNumber === (lastSession?.dayNumber ?? progress.currentDay))
  const trend = getMaxSetTrend(passed)
  // Preview day target only when there is no real last-set actual (do not overwrite 0 reps).
  const lastSetActual = lastSession ? getLastSetActual(lastSession) : null
  if (lastSetActual == null && day) {
    trend.current = getLastSetTarget(day.sets) ?? 0
  }

  const tests = await db.maxTests.where('program').equals(program).toArray()
  const maxTestRecord = tests.length ? Math.max(...tests.map((t) => t.reps)) : null

  const totalRepsAllTime = passed.reduce((sum, s) => sum + (s.totalReps ?? 0), 0)
  const streakWeeks = computeStreakWeeks(passed)

  let nextWorkoutLabel: string = pl.today
  if (progress.nextWorkoutAfter) {
    const next = new Date(progress.nextWorkoutAfter)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    next.setHours(0, 0, 0, 0)
    const diff = Math.ceil((next.getTime() - today.getTime()) / (86400000))
    nextWorkoutLabel = diff <= 0 ? pl.today : diff === 1 ? pl.tomorrow : pl.inDays(diff)
  }

  return {
    lastSession,
    nextWorkoutLabel,
    lastTotalReps: lastSession?.totalReps ?? null,
    maxLastSetTrend: trend,
    passedSessionCount: passed.length,
    totalRepsAllTime,
    streakWeeks,
    maxTestRecord,
    completedDaysInCycle: cycle ? getCompletedDaysInCycle(progress, cycle) : 0,
    cycleDaysTotal: cycle?.days.length ?? 0,
  }
}

/** Local Monday 00:00 — shared with heatmap (Pn–Nd) and best-streak. */
export function startOfLocalWeek(d: Date): Date {
  const cursor = new Date(d)
  cursor.setHours(0, 0, 0, 0)
  const day = cursor.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  cursor.setDate(cursor.getDate() + toMonday)
  return cursor
}

/** Stable week key = local Monday date (YYYY-MM-DD). */
export function getWeekKey(d: Date): string {
  const mon = startOfLocalWeek(d)
  const y = mon.getFullYear()
  const m = String(mon.getMonth() + 1).padStart(2, '0')
  const day = String(mon.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function computeStreakWeeks(passedSessions: LocalWorkoutSession[], now = new Date()): number {
  if (!passedSessions.length) return 0

  const weeksWithTraining = new Set<string>()
  for (const s of passedSessions) {
    weeksWithTraining.add(getWeekKey(new Date(s.startedAt)))
  }

  let streak = 0
  const cursor = startOfLocalWeek(now)

  for (let i = 0; i < 104; i++) {
    const key = getWeekKey(cursor)
    if (weeksWithTraining.has(key)) {
      streak++
      cursor.setDate(cursor.getDate() - 7)
    } else {
      break
    }
  }

  return streak
}

export async function getProgramRecords(program: Program): Promise<{
  bestTest: number | null
  bestMaxSet: number | null
  bestSessionTotal: number | null
  highestCycleName: string | null
}> {
  const tests = await db.maxTests.where('program').equals(program).toArray()
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.passed === true)
    .toArray()

  const bestTest = tests.length ? Math.max(...tests.map((t) => t.reps)) : null

  let bestMaxSet: number | null = null
  let bestSessionTotal: number | null = null
  for (const s of sessions) {
    const last = s.setResults[s.setResults.length - 1]
    if (last) bestMaxSet = Math.max(bestMaxSet ?? 0, last.actual)
    if (s.totalReps != null) bestSessionTotal = Math.max(bestSessionTotal ?? 0, s.totalReps)
  }

  let highestLevel = 0
  let highestCycleName: string | null = null
  for (const s of sessions) {
    const cycle = getCycleById(s.cycleId)
    if (!cycle) continue
    const lastDayNumber = Math.max(...cycle.days.map((d) => d.dayNumber))
    if (s.dayNumber === lastDayNumber && cycle.level > highestLevel) {
      highestLevel = cycle.level
      highestCycleName = cycle.nameShort
    }
  }

  return { bestTest, bestMaxSet, bestSessionTotal, highestCycleName }
}

export async function getMaxSetPerDay(
  program: Program,
  cycleId: string,
  cycleAttempt: number,
): Promise<{ day: number; maxActual: number }[]> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.cycleId === cycleId &&
        s.cycleAttempt === cycleAttempt &&
        s.status === 'completed' &&
        s.passed === true,
    )
    .toArray()

  const byDay = new Map<number, number>()
  for (const s of sessions) {
    const last = s.setResults[s.setResults.length - 1]
    if (!last) continue
    const prev = byDay.get(s.dayNumber) ?? 0
    byDay.set(s.dayNumber, Math.max(prev, last.actual))
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, maxActual]) => ({ day, maxActual }))
}

export type SessionChartPoint = {
  date: string
  dateLabel: string
  value: number
  dayNumber: number
}

/** Max-set (last set actual) per completed passed session — progression chart for training, not just tests. */
export async function getMaxSetPerSession(program: Program): Promise<SessionChartPoint[]> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.passed === true)
    .toArray()

  const points: SessionChartPoint[] = []
  for (const s of sessions) {
    const last = s.setResults[s.setResults.length - 1]
    if (!last) continue
    const at = s.completedAt ?? s.startedAt
    points.push({
      date: at,
      dateLabel: format(new Date(at), 'd MMM', { locale: plLocale }),
      value: last.actual,
      dayNumber: s.dayNumber,
    })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export type ProgramRecordsWithDates = {
  bestTest: number | null
  bestTestDate: string | null
  bestMaxSet: number | null
  bestMaxSetDate: string | null
  bestSessionTotal: number | null
  bestSessionTotalDate: string | null
  highestCycleName: string | null
}

/** Records with the date each was set — a coach needs to know when an athlete peaked. */
export async function getProgramRecordsWithDates(program: Program): Promise<ProgramRecordsWithDates> {
  const tests = await db.maxTests.where('program').equals(program).toArray()
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.passed === true)
    .toArray()

  let bestTest: number | null = null
  let bestTestDate: string | null = null
  for (const t of tests) {
    if (bestTest == null || t.reps > bestTest) {
      bestTest = t.reps
      bestTestDate = t.testedAt
    }
  }

  let bestMaxSet: number | null = null
  let bestMaxSetDate: string | null = null
  let bestSessionTotal: number | null = null
  let bestSessionTotalDate: string | null = null
  for (const s of sessions) {
    const at = s.completedAt ?? s.startedAt
    const last = s.setResults[s.setResults.length - 1]
    if (last && (bestMaxSet == null || last.actual > bestMaxSet)) {
      bestMaxSet = last.actual
      bestMaxSetDate = at
    }
    if (s.totalReps != null && (bestSessionTotal == null || s.totalReps > bestSessionTotal)) {
      bestSessionTotal = s.totalReps
      bestSessionTotalDate = at
    }
  }

  let highestLevel = 0
  let highestCycleName: string | null = null
  for (const s of sessions) {
    const cycle = getCycleById(s.cycleId)
    if (!cycle) continue
    const lastDayNumber = Math.max(...cycle.days.map((d) => d.dayNumber))
    if (s.dayNumber === lastDayNumber && cycle.level > highestLevel) {
      highestLevel = cycle.level
      highestCycleName = cycle.nameShort
    }
  }

  return {
    bestTest,
    bestTestDate,
    bestMaxSet,
    bestMaxSetDate,
    bestSessionTotal,
    bestSessionTotalDate,
    highestCycleName,
  }
}

export type ProgramVolumeStats = {
  /** Total reps in the last 14 days. */
  volume14d: number
  /** Total reps in the previous 14-day window — for trend comparison. */
  volumePrev14d: number
  /** Percent change between windows; null when previous was zero. */
  volumeChangePct: number | null
  /** Average total reps per passed session (work-capacity indicator). */
  avgRepsPerSession: number | null
  /** Average sessions per week over the tracked span. */
  avgSessionsPerWeek: number | null
  /** Sessions in the last 30 days. */
  sessionsLast30d: number
}

/** Volume and frequency stats — the hypertrophy/consistency lens for bodyweight athletes. */
export async function getProgramVolumeStats(program: Program): Promise<ProgramVolumeStats> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.passed === true)
    .toArray()

  const now = Date.now()
  const windowMs = 14 * 86400000
  let volume14d = 0
  let volumePrev14d = 0
  let sessionsLast30d = 0
  let totalRepsAll = 0
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const s of sessions) {
    const t = new Date(s.startedAt).getTime()
    const reps = s.totalReps ?? 0
    totalRepsAll += reps
    if (t >= now - windowMs) volume14d += reps
    else if (t >= now - 2 * windowMs) volumePrev14d += reps
    if (t >= now - 30 * 86400000) sessionsLast30d++
    const at = s.completedAt ?? s.startedAt
    if (!firstAt || at < firstAt) firstAt = at
    if (!lastAt || at > lastAt) lastAt = at
  }

  const volumeChangePct =
    volumePrev14d > 0 ? Math.round(((volume14d - volumePrev14d) / volumePrev14d) * 100) : null

  const avgRepsPerSession =
    sessions.length > 0 ? Math.round(totalRepsAll / sessions.length) : null

  let avgSessionsPerWeek: number | null = null
  if (firstAt && lastAt && lastAt !== firstAt) {
    const days = Math.max(
      1,
      Math.round((new Date(lastAt).getTime() - new Date(firstAt).getTime()) / 86400000),
    )
    avgSessionsPerWeek = Math.round((sessions.length / (days / 7)) * 10) / 10
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

export type DayCycleTrend = {
  dayNumber: number
  current: number | null
  previous: number | null
  delta: number | null
}

/** Compare max-set per day between the current cycle attempt and the previous one. */
export async function getDayCycleTrend(
  program: Program,
  cycleId: string,
  cycleAttempt: number,
): Promise<DayCycleTrend[]> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.cycleId === cycleId &&
        (s.cycleAttempt === cycleAttempt || s.cycleAttempt === cycleAttempt - 1) &&
        s.status === 'completed' &&
        s.passed === true,
    )
    .toArray()

  const byDayAttempt = new Map<string, number>()
  for (const s of sessions) {
    const last = s.setResults[s.setResults.length - 1]
    if (!last) continue
    const key = `${s.dayNumber}:${s.cycleAttempt}`
    const prev = byDayAttempt.get(key) ?? 0
    byDayAttempt.set(key, Math.max(prev, last.actual))
  }

  const dayNumbers = new Set<number>()
  for (const s of sessions) dayNumbers.add(s.dayNumber)

  return [...dayNumbers]
    .sort((a, b) => a - b)
    .map((dayNumber) => {
      const current = byDayAttempt.get(`${dayNumber}:${cycleAttempt}`) ?? null
      const previous = byDayAttempt.get(`${dayNumber}:${cycleAttempt - 1}`) ?? null
      return {
        dayNumber,
        current,
        previous,
        delta: current != null && previous != null ? current - previous : null,
      }
    })
}
