/**
 * Temporary store for pre-workout day edits (custom plans only).
 *
 * When the user edits a day in the WorkoutPreviewSheet before starting,
 * the modified PlanDay is stashed here. CustomWorkout.tsx picks it up
 * on init and applies it as the session's initial dayOverride.
 *
 * The override is consumed once — if the workout page never loads
 * (user backs out), the override simply evaporates with the process.
 */

import type { PlanDay } from '@/lib/exercise-model'

let pendingOverride: { planId: string; day: PlanDay } | null = null

export function setPendingDayOverride(planId: string, day: PlanDay): void {
  pendingOverride = { planId, day }
}

/** Returns the override if it matches the planId, then clears it. */
export function takePendingDayOverride(planId: string): PlanDay | null {
  if (pendingOverride?.planId === planId) {
    const day = pendingOverride.day
    pendingOverride = null
    return day
  }
  return null
}

export function clearPendingDayOverride(): void {
  pendingOverride = null
}
