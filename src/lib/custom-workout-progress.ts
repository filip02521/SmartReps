import type { ExerciseLog, PlanDay, SetPrescription } from '@/lib/exercise-model'
import type { RestTimerState } from '@/lib/rest-timer'
import { getGroupForExercise, getGroupExerciseIndices, getNextWorkoutPosition } from '@/lib/custom-workout-nav'

/** Target set/round count for rail and checklist (circuit uses group rounds). */
export function getExerciseTargetSetCount(day: PlanDay, exerciseIndex: number): number {
  const planned = day.exercises[exerciseIndex]
  if (!planned) return 0
  const group = getGroupForExercise(day, exerciseIndex)
  if (group?.kind === 'circuit') {
    return Math.max(1, group.rounds ?? 3)
  }
  return planned.sets.length
}

export function getChecklistSlots(
  day: PlanDay,
  exerciseIndex: number,
  completedSetCount = 0,
): SetPrescription[] {
  const planned = day.exercises[exerciseIndex]
  if (!planned || planned.sets.length === 0) return []
  const group = getGroupForExercise(day, exerciseIndex)
  const template = planned.sets[planned.sets.length - 1] ?? planned.sets[0]!

  if (group?.kind === 'circuit') {
    const rounds = getExerciseTargetSetCount(day, exerciseIndex)
    return Array.from({ length: rounds }, () => template)
  }

  if (group?.kind === 'amrap') {
    const slots = Math.max(1, completedSetCount + 1)
    return Array.from({ length: slots }, () => template)
  }

  return planned.sets
}

export function countPassedSets(log: ExerciseLog | undefined): number {
  return log?.sets.filter((s) => s.passed).length ?? 0
}

/** Rail / plan sheet: exercise finished (handles supersets jumping back). */
export function isExerciseDoneForDisplay(
  day: PlanDay,
  exerciseIndex: number,
  exerciseLogs: ExerciseLog[],
  currentExerciseIndex: number,
): boolean {
  if (exerciseIndex === currentExerciseIndex) return false
  const required = getExerciseTargetSetCount(day, exerciseIndex)
  const completed = countPassedSets(exerciseLogs[exerciseIndex])
  if (completed >= required) return true

  const group = getGroupForExercise(day, exerciseIndex)
  if (group?.kind === 'superset') {
    return completed >= required
  }

  return exerciseIndex < currentExerciseIndex && completed >= required
}

export function alignExerciseLogsToDay(
  day: PlanDay,
  logs: ExerciseLog[],
): ExerciseLog[] {
  return day.exercises.map((pe, i) => {
    const byId = logs.find((l) => l.exerciseId === pe.exerciseId)
    const byIndex = logs[i]
    const source =
      byId && byId.exerciseId === pe.exerciseId
        ? byId
        : byIndex?.exerciseId === pe.exerciseId
          ? byIndex
          : null
    return {
      exerciseId: pe.exerciseId,
      order: pe.order,
      sets: source?.sets ?? [],
    }
  })
}

export type ReconciledCustomResume = {
  day: PlanDay
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  currentSetIndex: number
}

/** Re-align resume pointers after plan edits or archived exercises. */
export function reconcileCustomWorkoutResume(
  day: PlanDay,
  exerciseLogs: ExerciseLog[],
  currentExerciseIndex: number,
  currentSetIndex: number,
): ReconciledCustomResume {
  const aligned = alignExerciseLogsToDay(day, exerciseLogs)
  const ex = Math.min(Math.max(0, currentExerciseIndex), day.exercises.length - 1)
  const set = Math.max(0, currentSetIndex)

  const at = day.exercises[ex]
  if (at && aligned[ex]?.exerciseId === at.exerciseId) {
    const required = getExerciseTargetSetCount(day, ex)
    if (set < required && countPassedSets(aligned[ex]) <= set) {
      return { day, exerciseLogs: aligned, currentExerciseIndex: ex, currentSetIndex: set }
    }
  }

  for (let i = 0; i < day.exercises.length; i++) {
    const required = getExerciseTargetSetCount(day, i)
    const done = countPassedSets(aligned[i])
    if (done < required) {
      return {
        day,
        exerciseLogs: aligned,
        currentExerciseIndex: i,
        currentSetIndex: done,
      }
    }
  }

  const last = day.exercises.length - 1
  return {
    day,
    exerciseLogs: aligned,
    currentExerciseIndex: Math.max(0, last),
    currentSetIndex: getExerciseTargetSetCount(day, last),
  }
}

export function findLastLoggedSet(exerciseLogs: ExerciseLog[]): {
  exerciseIndex: number
  setLogIndex: number
} | null {
  let lastEx = -1
  let lastSet = -1
  for (let i = 0; i < exerciseLogs.length; i++) {
    const log = exerciseLogs[i]
    if (log?.sets.length) {
      lastEx = i
      lastSet = log.sets.length - 1
    }
  }
  if (lastEx < 0 || lastSet < 0) return null
  return { exerciseIndex: lastEx, setLogIndex: lastSet }
}

/** Stale resume banner: total sets for current exercise position. */
export function staleResumeTotalSets(day: PlanDay, exerciseIndex: number): number {
  return getExerciseTargetSetCount(day, exerciseIndex)
}

export function getGroupLabelForExercise(day: PlanDay, exerciseIndex: number): string | null {
  const group = getGroupForExercise(day, exerciseIndex)
  if (!group) return null
  const indices = getGroupExerciseIndices(day, group.id)
  const pos = indices.indexOf(exerciseIndex)
  if (pos < 0) return null
  return `${pos + 1}/${indices.length}`
}

export function canUndoCustomSet(
  day: PlanDay,
  exerciseLogs: ExerciseLog[],
  currentExerciseIndex: number,
  currentSetIndex: number,
  restTimer: RestTimerState | null | undefined,
  failedIndex: number | undefined,
  amrapEndAt: number | null,
): boolean {
  if (restTimer && restTimer.mode !== 'idle') return false
  if (failedIndex === currentSetIndex) return false
  const last = findLastLoggedSet(exerciseLogs)
  if (!last) return false
  const log = exerciseLogs[last.exerciseIndex]
  const completed = log?.sets[last.setLogIndex]
  if (!completed) return false
  const step = getNextWorkoutPosition(
    day,
    last.exerciseIndex,
    completed.setNumber - 1,
    amrapEndAt,
  )
  if (step.dayComplete) return false
  return (
    step.next?.exerciseIndex === currentExerciseIndex &&
    step.next?.setIndex === currentSetIndex
  )
}
