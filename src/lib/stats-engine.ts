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

export function getWeekKey(d: Date): string {
  return `${d.getFullYear()}-W${getWeekNumber(d)}`
}

export function computeStreakWeeks(passedSessions: LocalWorkoutSession[]): number {
  if (!passedSessions.length) return 0

  const weeksWithTraining = new Set<string>()
  for (const s of passedSessions) {
    weeksWithTraining.add(getWeekKey(new Date(s.startedAt)))
  }

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

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

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
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
