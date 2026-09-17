import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'

const BUILTIN_MUSCLE_GROUP: Record<string, MuscleGroup> = {
  pushups: 'chest',
  pullups: 'back',
  squats: 'legs',
}

const DISPLAY_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'full_body',
]

export type MuscleBalance = {
  muscleGroup: MuscleGroup
  weeklySets: number
  status: 'optimal' | 'low' | 'minimal' | 'none'
}

export function computeMuscleBalance(
  sessions: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
  weeks = 4,
): MuscleBalance[] {
  const now = Date.now()
  const windowMs = weeks * 7 * 86400000

  // Build exercise muscleGroup lookup
  const exerciseMuscleMap = new Map<string, MuscleGroup | undefined>()
  for (const ex of exercises) {
    exerciseMuscleMap.set(ex.id, ex.muscleGroup)
  }

  const setsByGroup = new Map<MuscleGroup, number>()
  let earliestInWindow = Number.POSITIVE_INFINITY

  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const t = new Date(s.startedAt).getTime()
    if (t < now - windowMs) continue
    if (t < earliestInWindow) earliestInWindow = t

    if (isCustomWorkoutSession(s)) {
      // Custom session — use exercise logs
      if (s.exerciseLogs && s.exerciseLogs.length > 0) {
        for (const log of s.exerciseLogs) {
          const mg = exerciseMuscleMap.get(log.exerciseId)
          const sets = log.sets.length
          // Cardio sets are time blocks, not strength volume — excluded.
          // Exercises without a group (or deleted) keep their sets under
          // 'other' so performed work never vanishes from the balance.
          if (mg === 'cardio') continue
          const bucket = mg ?? 'other'
          setsByGroup.set(bucket, (setsByGroup.get(bucket) ?? 0) + sets)
        }
      }
    } else {
      // Builtin session
      const builtinSets = s.setResults?.length ?? 1
      const mg = BUILTIN_MUSCLE_GROUP[s.program]
      if (mg) {
        setsByGroup.set(mg, (setsByGroup.get(mg) ?? 0) + builtinSets)
      }
    }
  }

  // Normalize by the observed span (min 1 week, max `weeks`) — dividing a
  // new user's first-week volume by 4 would understate their weekly rate
  // and flag 'minimal' even after a heavy week.
  const spanWeeks =
    earliestInWindow === Number.POSITIVE_INFINITY
      ? weeks
      : Math.min(weeks, Math.max(1, Math.ceil((now - earliestInWindow) / (7 * 86400000))))

  const groups = [...DISPLAY_GROUPS]
  if ((setsByGroup.get('other') ?? 0) > 0) groups.push('other')

  return groups.map((mg) => {
    const totalSets = setsByGroup.get(mg) ?? 0
    const weeklySets = Math.round((totalSets / spanWeeks) * 10) / 10
    let status: MuscleBalance['status'] = 'none'
    if (weeklySets >= 10) status = 'optimal'
    else if (weeklySets >= 5) status = 'low'
    else if (weeklySets > 0) status = 'minimal'
    return { muscleGroup: mg, weeklySets, status }
  }).sort((a, b) => b.weeklySets - a.weeklySets)
}
