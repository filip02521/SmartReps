/**
 * Temporary store for pre-workout day edits and day selection (custom plans only).
 *
 * When the user edits a day in the WorkoutPreviewSheet before starting,
 * the modified PlanDay is stashed here. CustomWorkout.tsx picks it up
 * on init and applies it as the session's initial dayOverride.
 *
 * When the user picks a different day than the current progress day,
 * the dayNumber is stashed here so CustomWorkout starts that day instead.
 *
 * The override is consumed once — if the workout page never loads
 * (user backs out), the override simply evaporates with the process.
 */

import type { PlanDay } from '@/lib/exercise-model'

let pendingOverride: { planId: string; day: PlanDay } | null = null
let pendingDayNumber: { planId: string; dayNumber: number } | null = null

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

export function setPendingDayNumber(planId: string, dayNumber: number): void {
  pendingDayNumber = { planId, dayNumber }
}

/** Returns the pending day number if it matches the planId, then clears it. */
export function takePendingDayNumber(planId: string): number | null {
  if (pendingDayNumber?.planId === planId) {
    const { dayNumber } = pendingDayNumber
    pendingDayNumber = null
    return dayNumber
  }
  return null
}

export function clearPendingDayOverride(): void {
  pendingOverride = null
  pendingDayNumber = null
}
