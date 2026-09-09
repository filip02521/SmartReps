import { describe, it, expect } from 'vitest'
import { getNextWorkoutPosition } from '@/lib/custom-workout-nav'
import type { PlanDay, ExerciseGroup } from '@/lib/exercise-model'

function makeDay(overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    dayNumber: 1,
    restAfterDay: 1,
    exercises: [
      {
        exerciseId: 'ex1',
        order: 0,
        restBetweenSetsSec: 90,
        sets: [
          { reps: { kind: 'fixed', value: 10 } },
          { reps: { kind: 'fixed', value: 8 } },
          { reps: { kind: 'fixed', value: 6 } },
        ],
      },
    ],
    ...overrides,
  }
}

function makeDropsetGroup(): ExerciseGroup {
  return {
    id: 'dropset-1',
    kind: 'dropset',
    restAfterRoundSec: 0,
  }
}

describe('dropset navigation', () => {
  it('progresses linearly through sets with 0 rest between', () => {
    const day = makeDay({
      exercises: [
        {
          exerciseId: 'ex1',
          order: 0,
          restBetweenSetsSec: 90,
          groupId: 'dropset-1',
          sets: [
            { reps: { kind: 'fixed', value: 10 } },
            { reps: { kind: 'fixed', value: 8 } },
            { reps: { kind: 'fixed', value: 6 } },
          ],
        },
      ],
      groups: [makeDropsetGroup()],
    })

    // Set 1 → Set 2: should have 0 rest (dropset)
    const step1 = getNextWorkoutPosition(day, 0, 0)
    expect(step1.next).toEqual({ exerciseIndex: 0, setIndex: 1 })
    expect(step1.restSec).toBe(0)

    // Set 2 → Set 3: should have 0 rest (dropset)
    const step2 = getNextWorkoutPosition(day, 0, 1)
    expect(step2.next).toEqual({ exerciseIndex: 0, setIndex: 2 })
    expect(step2.restSec).toBe(0)
  })

  it('uses restAfterExerciseSec when moving to next exercise after dropset', () => {
    const day: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'ex1',
          order: 0,
          restBetweenSetsSec: 90,
          restAfterExerciseSec: 120,
          groupId: 'dropset-1',
          sets: [
            { reps: { kind: 'fixed', value: 10 } },
            { reps: { kind: 'fixed', value: 8 } },
          ],
        },
        {
          exerciseId: 'ex2',
          order: 1,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 12 } }],
        },
      ],
      groups: [makeDropsetGroup()],
    }

    // Last set of dropset → next exercise: should use restAfterExerciseSec
    const step = getNextWorkoutPosition(day, 0, 1)
    expect(step.next).toEqual({ exerciseIndex: 1, setIndex: 0 })
    expect(step.restSec).toBe(120)
  })

  it('completes day after last set of last exercise in dropset', () => {
    const day = makeDay({
      exercises: [
        {
          exerciseId: 'ex1',
          order: 0,
          restBetweenSetsSec: 90,
          groupId: 'dropset-1',
          sets: [
            { reps: { kind: 'fixed', value: 10 } },
            { reps: { kind: 'fixed', value: 8 } },
          ],
        },
      ],
      groups: [makeDropsetGroup()],
    })

    const step = getNextWorkoutPosition(day, 0, 1)
    expect(step.next).toBeNull()
    expect(step.dayComplete).toBe(true)
  })
})
