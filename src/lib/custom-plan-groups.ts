import type { ExerciseGroup, ExerciseGroupKind, PlanDay } from '@/lib/exercise-model'
import { generateId } from '@/lib/utils'

const DEFAULT_CIRCUIT_ROUNDS = 3
const DEFAULT_AMRAP_SEC = 600
const DEFAULT_GROUP_REST_SEC = 60

export function createExerciseGroup(kind: ExerciseGroupKind): ExerciseGroup {
  const base: ExerciseGroup = {
    id: generateId(),
    kind,
    restAfterRoundSec: DEFAULT_GROUP_REST_SEC,
  }
  if (kind === 'circuit') {
    return { ...base, rounds: DEFAULT_CIRCUIT_ROUNDS }
  }
  if (kind === 'amrap') {
    return { ...base, amrapDurationSec: DEFAULT_AMRAP_SEC }
  }
  return base
}

export function linkExercisesWithNext(
  day: PlanDay,
  exerciseIndex: number,
  kind: ExerciseGroupKind = 'superset',
): PlanDay {
  const nextIndex = exerciseIndex + 1
  if (nextIndex >= day.exercises.length) return day

  const current = day.exercises[exerciseIndex]!
  const next = day.exercises[nextIndex]!

  let groupId = current.groupId ?? next.groupId
  let groups = [...(day.groups ?? [])]

  if (groupId) {
    const existing = groups.find((g) => g.id === groupId)
    if (existing && existing.kind !== kind) {
      groupId = createExerciseGroup(kind).id
      groups = [...groups, { ...createExerciseGroup(kind), id: groupId }]
    }
  } else {
    const group = createExerciseGroup(kind)
    groupId = group.id
    groups.push(group)
  }

  const exercises = day.exercises.map((ex, i) => {
    if (i === exerciseIndex || i === nextIndex) return { ...ex, groupId }
    return ex
  })

  return { ...day, groups, exercises }
}

export function unlinkExerciseFromGroup(day: PlanDay, exerciseIndex: number): PlanDay {
  const ex = day.exercises[exerciseIndex]
  if (!ex?.groupId) return day

  const groupId = ex.groupId
  const exercises = day.exercises.map((e, i) =>
    i === exerciseIndex ? { ...e, groupId: undefined } : e,
  )

  const remaining = exercises.filter((e) => e.groupId === groupId)
  if (remaining.length <= 1) {
    const cleaned = exercises.map((e) =>
      e.groupId === groupId ? { ...e, groupId: undefined } : e,
    )
    return {
      ...day,
      exercises: cleaned,
      groups: day.groups?.filter((g) => g.id !== groupId),
    }
  }

  return { ...day, exercises }
}

export function updateExerciseGroup(
  day: PlanDay,
  groupId: string,
  patch: Partial<ExerciseGroup>,
): PlanDay {
  const groups = (day.groups ?? []).map((g) => (g.id === groupId ? { ...g, ...patch } : g))
  return { ...day, groups }
}

export function dissolveExerciseGroup(day: PlanDay, groupId: string): PlanDay {
  return {
    ...day,
    groups: day.groups?.filter((g) => g.id !== groupId),
    exercises: day.exercises.map((ex) =>
      ex.groupId === groupId ? { ...ex, groupId: undefined } : ex,
    ),
  }
}

export function countExercisesInGroup(day: PlanDay, groupId: string): number {
  return day.exercises.filter((ex) => ex.groupId === groupId).length
}
