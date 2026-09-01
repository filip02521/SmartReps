import type { ExerciseGroup, PlanDay, PlannedExercise } from '@/lib/exercise-model'

export type WorkoutPosition = {
  exerciseIndex: number
  setIndex: number
}

export type NextWorkoutStep = {
  next: WorkoutPosition | null
  restSec: number
  dayComplete: boolean
  startAmrap?: { groupId: string; endAt: number }
}

export function getGroupForExercise(
  day: PlanDay,
  exerciseIndex: number,
): ExerciseGroup | null {
  const groupId = day.exercises[exerciseIndex]?.groupId
  if (!groupId) return null
  return day.groups?.find((g) => g.id === groupId) ?? null
}

export function getGroupExerciseIndices(day: PlanDay, groupId: string): number[] {
  return day.exercises
    .map((ex, i) => (ex.groupId === groupId ? i : -1))
    .filter((i) => i >= 0)
}

function restAfterGroupRound(day: PlanDay, group: ExerciseGroup, lastExerciseIndex: number): number {
  if (group.restAfterRoundSec != null && group.restAfterRoundSec > 0) {
    return group.restAfterRoundSec
  }
  const last = day.exercises[lastExerciseIndex]
  return last?.restBetweenSetsSec ?? 0
}

function exitGroupPosition(day: PlanDay, groupIndices: number[]): NextWorkoutStep {
  const lastIdx = groupIndices[groupIndices.length - 1]!
  const nextEx = lastIdx + 1
  if (nextEx >= day.exercises.length) {
    return { next: null, restSec: 0, dayComplete: true }
  }
  const lastEx = day.exercises[lastIdx]!
  return {
    next: { exerciseIndex: nextEx, setIndex: 0 },
    restSec: lastEx.restAfterExerciseSec ?? lastEx.restBetweenSetsSec,
    dayComplete: false,
  }
}

function nextSupersetPosition(
  day: PlanDay,
  group: ExerciseGroup,
  exerciseIndex: number,
  setIndex: number,
): NextWorkoutStep {
  const indices = getGroupExerciseIndices(day, group.id)
  const posInGroup = indices.indexOf(exerciseIndex)
  if (posInGroup < 0) {
    return nextLinearPosition(day, exerciseIndex, setIndex)
  }

  for (let i = posInGroup + 1; i < indices.length; i++) {
    const idx = indices[i]!
    const ex = day.exercises[idx]!
    if (setIndex < ex.sets.length) {
      return { next: { exerciseIndex: idx, setIndex }, restSec: 0, dayComplete: false }
    }
  }

  const nextSetIndex = setIndex + 1
  for (const idx of indices) {
    const ex = day.exercises[idx]!
    if (nextSetIndex < ex.sets.length) {
      return {
        next: { exerciseIndex: idx, setIndex: nextSetIndex },
        restSec: restAfterGroupRound(day, group, indices[indices.length - 1]!),
        dayComplete: false,
      }
    }
  }

  return exitGroupPosition(day, indices)
}

function nextCircuitPosition(
  day: PlanDay,
  group: ExerciseGroup,
  exerciseIndex: number,
  roundIndex: number,
): NextWorkoutStep {
  const indices = getGroupExerciseIndices(day, group.id)
  const rounds = Math.max(1, group.rounds ?? 3)
  const posInGroup = indices.indexOf(exerciseIndex)
  if (posInGroup < 0) {
    return nextLinearPosition(day, exerciseIndex, roundIndex)
  }

  if (posInGroup + 1 < indices.length) {
    return {
      next: { exerciseIndex: indices[posInGroup + 1]!, setIndex: roundIndex },
      restSec: 0,
      dayComplete: false,
    }
  }

  const nextRound = roundIndex + 1
  if (nextRound < rounds) {
    return {
      next: { exerciseIndex: indices[0]!, setIndex: nextRound },
      restSec: restAfterGroupRound(day, group, indices[indices.length - 1]!),
      dayComplete: false,
    }
  }

  return exitGroupPosition(day, indices)
}

function nextAmrapPosition(
  day: PlanDay,
  group: ExerciseGroup,
  exerciseIndex: number,
  roundIndex: number,
  amrapEndAt: number | null,
): NextWorkoutStep {
  const indices = getGroupExerciseIndices(day, group.id)
  const posInGroup = indices.indexOf(exerciseIndex)
  if (posInGroup < 0) {
    return nextLinearPosition(day, exerciseIndex, roundIndex)
  }

  if (posInGroup + 1 < indices.length) {
    return {
      next: { exerciseIndex: indices[posInGroup + 1]!, setIndex: roundIndex },
      restSec: 0,
      dayComplete: false,
    }
  }

  const now = Date.now()
  if (amrapEndAt != null && now < amrapEndAt) {
    return {
      next: { exerciseIndex: indices[0]!, setIndex: roundIndex + 1 },
      restSec: 0,
      dayComplete: false,
    }
  }

  return exitGroupPosition(day, indices)
}

function nextLinearPosition(
  day: PlanDay,
  exerciseIndex: number,
  setIndex: number,
): NextWorkoutStep {
  const planned = day.exercises[exerciseIndex]
  if (!planned) {
    return { next: null, restSec: 0, dayComplete: true }
  }

  if (setIndex + 1 < planned.sets.length) {
    return {
      next: { exerciseIndex, setIndex: setIndex + 1 },
      restSec: planned.restBetweenSetsSec,
      dayComplete: false,
    }
  }

  if (exerciseIndex + 1 < day.exercises.length) {
    return {
      next: { exerciseIndex: exerciseIndex + 1, setIndex: 0 },
      restSec: planned.restAfterExerciseSec ?? planned.restBetweenSetsSec,
      dayComplete: false,
    }
  }

  return { next: null, restSec: 0, dayComplete: true }
}

/** Prescription index for circuit/amrap rounds (uses last set when round exceeds count). */
export function getPrescriptionSetIndex(
  day: PlanDay,
  exerciseIndex: number,
  positionSetIndex: number,
): number {
  const group = getGroupForExercise(day, exerciseIndex)
  const planned = day.exercises[exerciseIndex]
  if (!planned || planned.sets.length === 0) return 0
  if (group?.kind === 'circuit' || group?.kind === 'amrap') {
    return Math.min(positionSetIndex, planned.sets.length - 1)
  }
  return positionSetIndex
}

export function getPrescriptionForPosition(
  day: PlanDay,
  exerciseIndex: number,
  positionSetIndex: number,
): PlannedExercise['sets'][number] | undefined {
  const planned = day.exercises[exerciseIndex]
  if (!planned) return undefined
  const idx = getPrescriptionSetIndex(day, exerciseIndex, positionSetIndex)
  return planned.sets[idx]
}

export function shouldStartAmrap(
  day: PlanDay,
  exerciseIndex: number,
  setIndex: number,
  amrapEndAt: number | null,
): { groupId: string; endAt: number } | null {
  if (amrapEndAt != null) return null
  const group = getGroupForExercise(day, exerciseIndex)
  if (group?.kind !== 'amrap' || setIndex !== 0) return null
  const indices = getGroupExerciseIndices(day, group.id)
  if (indices[0] !== exerciseIndex) return null
  const duration = group.amrapDurationSec ?? 600
  return { groupId: group.id, endAt: Date.now() + duration * 1000 }
}

/** Compute next position after completing the set at (exerciseIndex, setIndex). */
export function getNextWorkoutPosition(
  day: PlanDay,
  exerciseIndex: number,
  setIndex: number,
  amrapEndAt: number | null = null,
): NextWorkoutStep {
  const group = getGroupForExercise(day, exerciseIndex)
  if (!group) {
    return nextLinearPosition(day, exerciseIndex, setIndex)
  }

  switch (group.kind) {
    case 'superset':
      return nextSupersetPosition(day, group, exerciseIndex, setIndex)
    case 'circuit':
      return nextCircuitPosition(day, group, exerciseIndex, setIndex)
    case 'amrap':
      return nextAmrapPosition(day, group, exerciseIndex, setIndex, amrapEndAt)
    default:
      return nextLinearPosition(day, exerciseIndex, setIndex)
  }
}

export function buildNextLabelPosition(
  day: PlanDay,
  current: WorkoutPosition,
): WorkoutPosition | null {
  const step = getNextWorkoutPosition(day, current.exerciseIndex, current.setIndex)
  return step.dayComplete ? null : step.next
}
