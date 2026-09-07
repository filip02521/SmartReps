import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'
import { formatDurationDisplay } from '@/lib/custom-prescription-format'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'

export function sessionTotalSets(session: LocalWorkoutSession): number {
  if (session.exerciseLogs?.length) {
    return session.exerciseLogs.reduce((sum, log) => sum + log.sets.length, 0)
  }
  return session.setResults.length
}

export function computeCustomSessionDetail(
  logs: ExerciseLog[] | undefined,
  exerciseMap?: Map<string, ExerciseDefinition>,
  weightUnit: 'kg' | 'lb' = 'kg',
): string {
  if (!logs?.length) return ''

  let reps = 0
  let durationSec = 0
  let durationMin = 0
  let maxWeightKg: number | null = null

  for (const log of logs) {
    const def = exerciseMap?.get(log.exerciseId)
    const isMin = def?.durationDisplayUnit === 'min'
    for (const set of log.sets) {
      reps += set.actual.reps ?? 0
      const dur = set.actual.durationSec ?? 0
      if (dur > 0) {
        if (isMin) durationMin += dur
        else durationSec += dur
      }
      if (set.actual.weightKg != null) {
        maxWeightKg =
          maxWeightKg == null
            ? set.actual.weightKg
            : Math.max(maxWeightKg, set.actual.weightKg)
      }
    }
  }

  const parts: string[] = []
  if (reps > 0) parts.push(`${reps} ${pl.repsUnit}`)
  if (durationSec > 0) parts.push(formatDurationDisplay(durationSec, 'sec'))
  if (durationMin > 0) parts.push(formatDurationDisplay(durationMin, 'min'))
  if (maxWeightKg != null) {
    parts.push(`${kgToDisplay(maxWeightKg, weightUnit)} ${weightUnitLabel(weightUnit)}`)
  }
  return parts.join(' · ')
}

export function formatCustomSessionSummary(
  exerciseCount: number,
  setCount: number,
  detail: string,
): string {
  const base = `${pl.planExercisesShort(exerciseCount)} · ${pl.planSetsShort(setCount)}`
  return detail ? `${base} · ${detail}` : base
}
