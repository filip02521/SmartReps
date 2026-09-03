import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

/**
 * Suggest substitute exercises based on muscle group similarity.
 * Exercises with the same muscle group are ranked first,
 * then exercises with compatible metrics.
 */
export function suggestSubstitutes(
  allExercises: ExerciseDefinition[],
  currentExerciseId: string,
  limit = 5,
): ExerciseDefinition[] {
  const current = allExercises.find((e) => e.id === currentExerciseId)
  if (!current) return []

  const candidates = allExercises.filter(
    (e) => e.id !== currentExerciseId && !e.archived,
  )

  const sameGroup = current.muscleGroup
    ? candidates.filter((e) => e.muscleGroup === current.muscleGroup)
    : []

  const sameMetric = candidates.filter(
    (e) => e.primaryMetric === current.primaryMetric && !sameGroup.includes(e),
  )

  const rest = candidates.filter(
    (e) => !sameGroup.includes(e) && !sameMetric.includes(e),
  )

  return [...sameGroup, ...sameMetric, ...rest].slice(0, limit)
}

export function muscleGroupLabel(group: MuscleGroup): string {
  return pl[`muscleGroup_${group}`] ?? group
}
