import { describe, expect, it } from 'vitest'
import type { CustomPlan, ExerciseLog, PlanDay } from '@/lib/exercise-model'
import {
  alignExerciseLogsToDay,
  canJumpToExercise,
  canUndoCustomSet,
  findNextIncompletePosition,
  getChecklistSlots,
  getExerciseTargetSetCount,
  isExerciseDoneForDisplay,
  isExerciseIncomplete,
  reconcileCustomWorkoutResume,
  resumeSetIndexForExercise,
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

describe('canJumpToExercise + resumeSetIndexForExercise', () => {
  const linearDay: PlanDay = {
    dayNumber: 1,
    restAfterDay: 1,
    exercises: [
      {
        exerciseId: 'a',
        order: 0,
        sets: [
          { reps: { kind: 'exact', value: 10 } },
          { reps: { kind: 'exact', value: 10 } },
        ],
        restBetweenSetsSec: 60,
      },
      {
        exerciseId: 'b',
        order: 1,
        sets: [{ reps: { kind: 'exact', value: 8 } }],
        restBetweenSetsSec: 60,
      },
      {
        exerciseId: 'c',
        order: 2,
        sets: [{ reps: { kind: 'exact', value: 12 } }],
        restBetweenSetsSec: 60,
      },
    ],
  }

  it('allows jump to incomplete later/earlier exercises, not current or finished', () => {
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 10 },
            prescription: linearDay.exercises[0]!.sets[0]!,
          },
        ],
      },
      { exerciseId: 'b', order: 1, sets: [] },
      {
        exerciseId: 'c',
        order: 2,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 12 },
            prescription: linearDay.exercises[2]!.sets[0]!,
          },
        ],
      },
    ]
    expect(canJumpToExercise(linearDay, logs, 0, 0)).toBe(false)
    expect(canJumpToExercise(linearDay, logs, 0, 1)).toBe(true)
    expect(canJumpToExercise(linearDay, logs, 0, 2)).toBe(false)
    expect(resumeSetIndexForExercise(linearDay, logs, 0)).toBe(1)
    expect(resumeSetIndexForExercise(linearDay, logs, 1)).toBe(0)
  })

  it('allows jump within circuit to unfinished partner', () => {
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 10 },
            prescription: circuitDay.exercises[0]!.sets[0]!,
          },
        ],
      },
      { exerciseId: 'b', order: 1, sets: [] },
    ]
    expect(canJumpToExercise(circuitDay, logs, 0, 1)).toBe(true)
    expect(resumeSetIndexForExercise(circuitDay, logs, 1)).toBe(0)
  })

  it('findNextIncompletePosition skips finished exercises after out-of-order work', () => {
    const logs: ExerciseLog[] = [
      { exerciseId: 'a', order: 0, sets: [] },
      {
        exerciseId: 'b',
        order: 1,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 8 },
            prescription: linearDay.exercises[1]!.sets[0]!,
          },
        ],
      },
      {
        exerciseId: 'c',
        order: 2,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 12 },
            prescription: linearDay.exercises[2]!.sets[0]!,
          },
        ],
      },
    ]
    expect(findNextIncompletePosition(linearDay, logs)).toEqual({
      exerciseIndex: 0,
      setIndex: 0,
    })
    expect(isExerciseIncomplete(linearDay, logs, 1)).toBe(false)
  })

  it('amrap jump only while group active or before first required set', () => {
    const amrapDay: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      groups: [{ id: 'am', kind: 'amrap', amrapDurationSec: 300 }],
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          groupId: 'am',
          sets: [{ reps: { kind: 'exact', value: 10 } }],
          restBetweenSetsSec: 0,
        },
        {
          exerciseId: 'b',
          order: 1,
          groupId: 'am',
          sets: [{ reps: { kind: 'exact', value: 8 } }],
          restBetweenSetsSec: 0,
        },
      ],
    }
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 10 },
            prescription: amrapDay.exercises[0]!.sets[0]!,
          },
        ],
      },
      {
        exerciseId: 'b',
        order: 1,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 8 },
            prescription: amrapDay.exercises[1]!.sets[0]!,
          },
        ],
      },
    ]
    expect(canJumpToExercise(amrapDay, logs, 0, 1)).toBe(false)
    expect(canJumpToExercise(amrapDay, logs, 0, 1, { amrapGroupId: 'am' })).toBe(true)
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
