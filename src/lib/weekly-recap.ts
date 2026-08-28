import { startOfWeek, subWeeks } from 'date-fns'
import { db, type LocalWorkoutSession } from '@/lib/db'
import { computeStreakWeeks, getWeekKey } from '@/lib/stats-engine'

export type WeeklyRecap = {
  sessionsThisWeek: number
  repsThisWeek: number
  deltaSessionsVsPrevWeek: number
  streakWeeks: number
  bestStreakWeeks: number
}

function weekBounds(ref: Date): { start: Date; end: Date } {
  const start = startOfWeek(ref, { weekStartsOn: 1 })
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

function sessionsInWeek(
  passed: LocalWorkoutSession[],
  ref: Date,
): { count: number; reps: number } {
  const { start, end } = weekBounds(ref)
  let count = 0
  let reps = 0
  for (const s of passed) {
    const t = new Date(s.startedAt).getTime()
    if (t >= start.getTime() && t < end.getTime()) {
      count++
      reps += s.totalReps ?? 0
    }
  }
  return { count, reps }
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

export async function loadWeeklyRecap(now = new Date()): Promise<WeeklyRecap> {
  const allSessions = await db.workoutSessions.toArray()
  const passed = allSessions.filter((s) => s.status === 'completed' && s.passed)

  const thisWeek = sessionsInWeek(passed, now)
  const prevWeek = sessionsInWeek(passed, subWeeks(now, 1))

  return {
    sessionsThisWeek: thisWeek.count,
    repsThisWeek: thisWeek.reps,
    deltaSessionsVsPrevWeek: thisWeek.count - prevWeek.count,
    streakWeeks: computeStreakWeeks(passed),
    bestStreakWeeks: computeBestStreakWeeks(passed),
  }
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
  return Math.floor((today.getTime() - last.getTime()) / 86400000)
}
