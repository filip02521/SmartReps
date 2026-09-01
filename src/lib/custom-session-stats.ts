import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseLog } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

export function sessionTotalSets(session: LocalWorkoutSession): number {
  if (session.exerciseLogs?.length) {
    return session.exerciseLogs.reduce((sum, log) => sum + log.sets.length, 0)
  }
  return session.setResults.length
}

export function computeCustomSessionDetail(logs: ExerciseLog[] | undefined): string {
  if (!logs?.length) return ''

  let reps = 0
  let durationSec = 0
  let maxWeightKg: number | null = null

  for (const log of logs) {
    for (const set of log.sets) {
      reps += set.actual.reps ?? 0
      durationSec += set.actual.durationSec ?? 0
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
  if (durationSec > 0) parts.push(`${durationSec}s`)
  if (maxWeightKg != null) parts.push(`${maxWeightKg} kg`)
  return parts.join(' · ')
}

export function formatCustomSessionSummary(
  exerciseCount: number,
  setCount: number,
  detail: string,
): string {
  const base = `${exerciseCount} ćw. · ${pl.planSetsShort(setCount)}`
  return detail ? `${base} · ${detail}` : base
}
