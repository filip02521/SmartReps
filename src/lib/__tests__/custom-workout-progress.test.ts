import { describe, expect, it } from 'vitest'
import type { CustomPlan, ExerciseLog, PlanDay } from '@/lib/exercise-model'
import {
  alignExerciseLogsToDay,
  canUndoCustomSet,
  getChecklistSlots,
  getExerciseTargetSetCount,
  isExerciseDoneForDisplay,
  reconcileCustomWorkoutResume,
  staleResumeTotalSets,
} from '@/lib/custom-workout-progress'

const circuitDay: PlanDay = {
  dayNumber: 1,
  restAfterDay: 1,
  groups: [{ id: 'g1', kind: 'circuit', rounds: 4, restAfterRoundSec: 60 }],
  exercises: [
    {
      exerciseId: 'a',
      order: 0,
      groupId: 'g1',
      sets: [{ reps: { kind: 'exact', value: 10 } }],
      restBetweenSetsSec: 0,
    },
    {
      exerciseId: 'b',
      order: 1,
      groupId: 'g1',
      sets: [{ reps: { kind: 'exact', value: 8 } }],
      restBetweenSetsSec: 0,
    },
  ],
}

describe('getExerciseTargetSetCount', () => {
  it('uses group rounds for circuit', () => {
    expect(getExerciseTargetSetCount(circuitDay, 0)).toBe(4)
    expect(getExerciseTargetSetCount(circuitDay, 1)).toBe(4)
  })
})

describe('getChecklistSlots', () => {
  it('expands circuit to round count', () => {
    expect(getChecklistSlots(circuitDay, 0, 0)).toHaveLength(4)
  })
})

describe('isExerciseDoneForDisplay', () => {
  it('does not mark superset partner done while revisiting earlier index', () => {
    const day: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      groups: [{ id: 'ss', kind: 'superset', restAfterRoundSec: 90 }],
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          groupId: 'ss',
          sets: [
            { reps: { kind: 'exact', value: 10 } },
            { reps: { kind: 'exact', value: 10 } },
          ],
          restBetweenSetsSec: 0,
        },
        {
          exerciseId: 'b',
          order: 1,
          groupId: 'ss',
          sets: [{ reps: { kind: 'exact', value: 8 } }],
          restBetweenSetsSec: 0,
        },
      ],
    }
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [{ setNumber: 1, passed: true, actual: { reps: 10 }, prescription: day.exercises[0]!.sets[0]! }],
      },
      { exerciseId: 'b', order: 1, sets: [] },
    ]
    expect(isExerciseDoneForDisplay(day, 0, logs, 1)).toBe(false)
    expect(isExerciseDoneForDisplay(day, 1, logs, 1)).toBe(false)
  })
})

describe('reconcileCustomWorkoutResume', () => {
  it('realigns logs after exercise list changes', () => {
    const day: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          sets: [{ reps: { kind: 'exact', value: 10 } }],
          restBetweenSetsSec: 60,
        },
        {
          exerciseId: 'b',
          order: 1,
          sets: [{ reps: { kind: 'exact', value: 8 } }],
          restBetweenSetsSec: 60,
        },
      ],
    }
    const oldLogs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [{ setNumber: 1, passed: true, actual: { reps: 10 }, prescription: day.exercises[0]!.sets[0]! }],
      },
      { exerciseId: 'removed', order: 1, sets: [] },
    ]
    const reconciled = reconcileCustomWorkoutResume(day, oldLogs, 1, 0)
    expect(reconciled.exerciseLogs[0]?.sets).toHaveLength(1)
    expect(reconciled.exerciseLogs[1]?.exerciseId).toBe('b')
    expect(reconciled.currentExerciseIndex).toBe(1)
    expect(reconciled.currentSetIndex).toBe(0)
  })
})

describe('canUndoCustomSet', () => {
  it('allows undo after superset advance to partner exercise', () => {
    const day: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      groups: [{ id: 'ss', kind: 'superset' }],
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          groupId: 'ss',
          sets: [{ reps: { kind: 'exact', value: 10 } }],
          restBetweenSetsSec: 0,
        },
        {
          exerciseId: 'b',
          order: 1,
          groupId: 'ss',
          sets: [{ reps: { kind: 'exact', value: 8 } }],
          restBetweenSetsSec: 0,
        },
      ],
    }
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [{ setNumber: 1, passed: true, actual: { reps: 10 }, prescription: day.exercises[0]!.sets[0]! }],
      },
      { exerciseId: 'b', order: 1, sets: [] },
    ]
    expect(canUndoCustomSet(day, logs, 1, 0, null, undefined, null)).toBe(true)
  })
})

describe('staleResumeTotalSets', () => {
  it('uses circuit rounds in stale banner', () => {
    expect(staleResumeTotalSets(circuitDay, 0)).toBe(4)
  })
})

describe('alignExerciseLogsToDay', () => {
  it('matches logs by exercise id', () => {
    const plan = { days: [circuitDay] } as CustomPlan
    void plan
    const aligned = alignExerciseLogsToDay(circuitDay, [
      { exerciseId: 'b', order: 99, sets: [] },
      { exerciseId: 'a', order: 99, sets: [] },
    ])
    expect(aligned[0]?.exerciseId).toBe('a')
    expect(aligned[1]?.exerciseId).toBe('b')
  })
})
