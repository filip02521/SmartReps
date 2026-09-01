import type { CustomProgramProgress } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'

export type CustomCycleDayStatus = 'passed' | 'failed' | 'current' | 'upcoming' | 'rest'

export function sessionsForCycleAttempt(
  sessions: LocalWorkoutSession[],
  cycleAttempt: number,
): LocalWorkoutSession[] {
  return sessions.filter((s) => s.cycleAttempt === cycleAttempt)
}

export function resolveCustomCycleDayStatus(
  dayNumber: number,
  progress: CustomProgramProgress | null,
  sessions: LocalWorkoutSession[],
): CustomCycleDayStatus {
  if (!progress) return 'upcoming'
  const attempt = progress.cycleAttempt
  const relevant = sessionsForCycleAttempt(sessions, attempt)
  const current = progress.currentDay

  const latestForDay = relevant
    .filter((s) => s.dayNumber === dayNumber && s.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.startedAt).getTime() -
        new Date(a.completedAt ?? a.startedAt).getTime(),
    )[0]

  const passed = latestForDay?.passed === true
  const failed = latestForDay?.passed === false

  if (dayNumber === current) {
    if (progress.status === 'rest') return 'rest'
    if (failed) return 'failed'
    return 'current'
  }
  if (dayNumber < current) {
    if (passed) return 'passed'
    if (failed) return 'failed'
    return 'upcoming'
  }
  return 'upcoming'
}
