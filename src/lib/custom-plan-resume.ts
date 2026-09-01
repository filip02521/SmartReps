import { db } from '@/lib/db'
import {
  customSessionHasProgress,
  reconcileActiveCustomWorkout,
} from '@/lib/custom-session-service'
import { isStaleActiveWorkout } from '@/lib/sync'

export type CustomPlanResumeInfo = {
  day: number
  set: number
  totalSets: number
  stale: boolean
}

/** Resume banner for an active custom plan with at least one completed set. */
export async function getCustomPlanResumeInfo(
  planId: string,
): Promise<CustomPlanResumeInfo | null> {
  const active = await reconcileActiveCustomWorkout(planId)
  if (!active) return null

  const session = await db.workoutSessions.get(active.sessionId)
  if (!session || session.status !== 'in_progress') return null
  if (!customSessionHasProgress(active.exerciseLogs)) return null

  const plan = await db.customPlans.get(planId)
  const dayPlan = plan?.days.find((d) => d.dayNumber === session.dayNumber)
  const exercise = dayPlan?.exercises[active.currentExerciseIndex]
  const totalSets = exercise?.sets.length ?? 1

  return {
    day: session.dayNumber,
    set: active.currentSetIndex + 1,
    totalSets,
    stale: isStaleActiveWorkout(active.updatedAt),
  }
}
