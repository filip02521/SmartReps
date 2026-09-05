import { db, type LocalWorkoutSession } from '@/lib/db'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'

export async function getLastPassedCustomSession(
  customPlanId: string,
  dayNumber: number,
  cycleAttempt: number,
  excludeSessionId?: string,
): Promise<LocalWorkoutSession | undefined> {
  const sessions = await db.workoutSessions.where('customPlanId').equals(customPlanId).toArray()
  const candidates = sessions
    .filter(
      (s) =>
        isCustomWorkoutSession(s) &&
        s.status === 'completed' &&
        s.dayNumber === dayNumber &&
        s.cycleAttempt < cycleAttempt &&
        s.id !== excludeSessionId,
    )
    .sort((a, b) => b.cycleAttempt - a.cycleAttempt)
  return candidates[0]
}

/** Current session + previous completed session for same plan/day (prior attempt). */
export async function getCustomSessionComparison(
  customPlanId: string,
  sessionId: string,
): Promise<{ current: LocalWorkoutSession | undefined; previous: LocalWorkoutSession | undefined }> {
  const current = await db.workoutSessions.get(sessionId)
  if (!current || !isCustomWorkoutSession(current)) {
    return { current: undefined, previous: undefined }
  }

  // First try: same day, prior cycle attempt
  let previous = await getLastPassedCustomSession(
    customPlanId,
    current.dayNumber,
    current.cycleAttempt,
    current.id,
  )

  // Second try: same day, same cycle attempt
  if (!previous) {
    const sameAttempt = await db.workoutSessions
      .where('customPlanId')
      .equals(customPlanId)
      .filter(
        (s) =>
          isCustomWorkoutSession(s) &&
          s.status === 'completed' &&
          s.dayNumber === current.dayNumber &&
          s.cycleAttempt === current.cycleAttempt &&
          s.id !== current.id,
      )
      .toArray()
    sameAttempt.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    previous = sameAttempt[0]
  }

  // Third try: same day, any cycle attempt
  if (!previous) {
    const sameDay = await db.workoutSessions
      .where('customPlanId')
      .equals(customPlanId)
      .filter(
        (s) =>
          isCustomWorkoutSession(s) &&
          s.status === 'completed' &&
          s.dayNumber === current.dayNumber &&
          s.id !== current.id,
      )
      .toArray()
    sameDay.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    previous = sameDay[0]
  }

  // Fourth try: most recent completed session for this plan (any day)
  if (!previous) {
    const anyDay = await db.workoutSessions
      .where('customPlanId')
      .equals(customPlanId)
      .filter(
        (s) =>
          isCustomWorkoutSession(s) &&
          s.status === 'completed' &&
          s.id !== current.id,
      )
      .toArray()
    anyDay.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    previous = anyDay[0]
  }

  return { current, previous }
}

export function customSessionTotalReps(session: LocalWorkoutSession): number {
  if (session.exerciseLogs?.length) {
    return session.exerciseLogs.reduce(
      (sum, log) => sum + log.sets.reduce((s, set) => s + (set.actual.reps ?? 0), 0),
      0,
    )
  }
  return session.totalReps ?? session.setResults.reduce((s, r) => s + r.actual, 0)
}

export function customSessionTotalDurationSec(session: LocalWorkoutSession): number {
  if (!session.exerciseLogs?.length) return 0
  return session.exerciseLogs.reduce(
    (sum, log) =>
      sum + log.sets.reduce((s, set) => s + (set.actual.durationSec ?? 0), 0),
    0,
  )
}

export function customSessionPassedSets(session: LocalWorkoutSession): { passed: number; total: number } {
  if (!session.exerciseLogs?.length) {
    const rows = session.setResults
    return { passed: rows.filter((r) => r.passed).length, total: rows.length }
  }
  let passed = 0
  let total = 0
  for (const log of session.exerciseLogs) {
    for (const set of log.sets) {
      total++
      if (set.passed) passed++
    }
  }
  return { passed, total }
}

/** True when any logged set missed its prescription (soft note — not a failed day). */
export function customSessionHasBelowTarget(session: LocalWorkoutSession): boolean {
  const { passed, total } = customSessionPassedSets(session)
  return total > 0 && passed < total
}
