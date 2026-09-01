import { db } from '@/lib/db'
import type { ExerciseDefinition, PlannedExercise, CustomPlan } from '@/lib/exercise-model'

export type CustomLoadErrorKind = 'empty_day' | 'missing_exercise'

export function filterValidDayExercises(
  exercises: PlannedExercise[],
  exerciseMap: Map<string, ExerciseDefinition>,
): PlannedExercise[] {
  return exercises.filter((e) => {
    const def = exerciseMap.get(e.exerciseId)
    return def != null && !def.archived
  })
}

export function findFirstMissingExercise(
  exercises: PlannedExercise[],
  exerciseMap: Map<string, ExerciseDefinition>,
): PlannedExercise | undefined {
  return exercises.find((e) => {
    const def = exerciseMap.get(e.exerciseId)
    return !def || def.archived
  })
}

export function replaceExerciseInDay(
  plan: CustomPlan,
  dayNumber: number,
  fromExerciseId: string,
  toExerciseId: string,
): CustomPlan {
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day
      return {
        ...day,
        exercises: day.exercises.map((pe) =>
          pe.exerciseId === fromExerciseId ? { ...pe, exerciseId: toExerciseId } : pe,
        ),
      }
    }),
  }
}

export async function getActiveCustomWorkoutDay(planId: string): Promise<number | null> {
  const active = await db.activeCustomWorkout.get(planId)
  if (!active) return null
  const session = await db.workoutSessions.get(active.sessionId)
  return session?.dayNumber ?? null
}

export function isCustomDayLockedForEdit(
  activeDayNumber: number | null,
  editingDayNumber: number,
): boolean {
  return !canEditCustomPlanDay(activeDayNumber, editingDayNumber)
}

export function canEditCustomPlanDay(
  activeDayNumber: number | null,
  dayNumber: number,
): boolean {
  if (activeDayNumber == null) return true
  return activeDayNumber !== dayNumber
}
