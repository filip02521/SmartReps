import { startOfWeek, subWeeks } from 'date-fns'
import { db, type LocalWorkoutSession } from '@/lib/db'
import { computeStreakWeeks, getWeekKey } from '@/lib/stats-engine'

const MS_PER_DAY = 86400000

export type ActivityInsights = {
  sessions14d: number
  reps14d: number
  sessionsPrev14d: number
  repsPrev14d: number
  repsChangePct: number | null
  sessionsDelta14d: number
  streakWeeks: number
  bestStreakWeeks: number
  repsWeekChangePct: number | null
}

function weekBounds(ref: Date): { start: Date; end: Date } {
  const start = startOfWeek(ref, { weekStartsOn: 1 })
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

function aggregateInRange(
  passed: LocalWorkoutSession[],
  startMs: number,
  endMs: number,
): { count: number; reps: number } {
  let count = 0
  let reps = 0
  for (const s of passed) {
    const t = new Date(s.startedAt).getTime()
    if (t >= startMs && t < endMs) {
      count++
      reps += s.totalReps ?? 0
    }
  }
  return { count, reps }
}

function sessionsInWeek(
  passed: LocalWorkoutSession[],
  ref: Date,
): { count: number; reps: number } {
  const { start, end } = weekBounds(ref)
  return aggregateInRange(passed, start.getTime(), end.getTime())
}

/** Percent change rounded to whole number; null when previous period had zero reps. */
export function computeRepsChangePct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export function buildActivityInsights(
  passed: LocalWorkoutSession[],
  now = new Date(),
): ActivityInsights {
  const nowMs = now.getTime()
  const windowMs = 14 * MS_PER_DAY
  const current = aggregateInRange(passed, nowMs - windowMs, nowMs)
  const previous = aggregateInRange(passed, nowMs - 2 * windowMs, nowMs - windowMs)
  const thisWeek = sessionsInWeek(passed, now)
  const prevWeek = sessionsInWeek(passed, subWeeks(now, 1))

  return {
    sessions14d: current.count,
    reps14d: current.reps,
    sessionsPrev14d: previous.count,
    repsPrev14d: previous.reps,
    repsChangePct: computeRepsChangePct(current.reps, previous.reps),
    sessionsDelta14d: current.count - previous.count,
    streakWeeks: computeStreakWeeks(passed),
    bestStreakWeeks: computeBestStreakWeeks(passed),
    repsWeekChangePct: computeRepsChangePct(thisWeek.reps, prevWeek.reps),
  }
}

export function computeBestStreakWeeks(passedSessions: LocalWorkoutSession[]): number {
  if (!passedSessions.length) return 0

  const weeksWithTraining = new Set<string>()
  for (const s of passedSessions) {
    weeksWithTraining.add(getWeekKey(new Date(s.startedAt)))
  }

  const timestamps = passedSessions.map((s) => new Date(s.startedAt).getTime())
  const cursor = new Date(Math.min(...timestamps))
  cursor.setHours(0, 0, 0, 0)
  const day = cursor.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  cursor.setDate(cursor.getDate() + toMonday)

  const end = new Date(Math.max(...timestamps))
  let best = 0
  let run = 0

  while (cursor.getTime() <= end.getTime()) {
    if (weeksWithTraining.has(getWeekKey(cursor))) {
      run++
      best = Math.max(best, run)
    } else {
      run = 0
    }
    cursor.setDate(cursor.getDate() + 7)
  }

  return best
}

export async function loadActivityInsights(now = new Date()): Promise<ActivityInsights> {
  const allSessions = await db.workoutSessions.toArray()
  const completed = allSessions.filter((s) => s.status === 'completed')
  return buildActivityInsights(completed, now)
}

export function daysSinceLastPassedSession(
  passedSessions: LocalWorkoutSession[],
  now = new Date(),
): number | null {
  if (!passedSessions.length) return null
  const latest = passedSessions.reduce((max, s) =>
    new Date(s.startedAt).getTime() > max ? new Date(s.startedAt).getTime() : max,
  0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const last = new Date(latest)
  last.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - last.getTime()) / MS_PER_DAY)
}
