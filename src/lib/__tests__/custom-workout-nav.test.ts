import { describe, expect, it } from 'vitest'
import type { PlanDay } from '@/lib/exercise-model'
import { getNextWorkoutPosition } from '@/lib/custom-workout-nav'

function day(partial: Partial<PlanDay> & Pick<PlanDay, 'exercises'>): PlanDay {
  return {
    dayNumber: 1,
    restAfterDay: 1,
    ...partial,
  }
}

describe('getNextWorkoutPosition', () => {
  it('advances linearly through sets and exercises', () => {
    const d = day({
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          restBetweenSetsSec: 60,
          restAfterExerciseSec: 90,
          sets: [{ reps: { kind: 'fixed', value: 10 } }, { reps: { kind: 'fixed', value: 10 } }],
        },
        {
          exerciseId: 'b',
          order: 1,
          restBetweenSetsSec: 45,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
        },
      ],
    })

    expect(getNextWorkoutPosition(d, 0, 0)).toMatchObject({
      next: { exerciseIndex: 0, setIndex: 1 },
      restSec: 60,
      dayComplete: false,
    })
    expect(getNextWorkoutPosition(d, 0, 1)).toMatchObject({
      next: { exerciseIndex: 1, setIndex: 0 },
      restSec: 90,
      dayComplete: false,
    })
    expect(getNextWorkoutPosition(d, 1, 0)).toMatchObject({
      next: null,
      dayComplete: true,
    })
  })

  it('interleaves superset exercises without rest between pair', () => {
    const groupId = 'g1'
    const d = day({
      groups: [{ id: groupId, kind: 'superset', restAfterRoundSec: 30 }],
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          groupId,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 10 } }, { reps: { kind: 'fixed', value: 10 } }],
        },
        {
          exerciseId: 'b',
          order: 1,
          groupId,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
        },
      ],
    })

    expect(getNextWorkoutPosition(d, 0, 0)).toMatchObject({
      next: { exerciseIndex: 1, setIndex: 0 },
      restSec: 0,
    })
    expect(getNextWorkoutPosition(d, 1, 0)).toMatchObject({
      next: { exerciseIndex: 0, setIndex: 1 },
      restSec: 30,
    })
  })

  it('walks circuit rounds then exits group', () => {
    const groupId = 'c1'
    const d = day({
      groups: [{ id: groupId, kind: 'circuit', rounds: 2, restAfterRoundSec: 20 }],
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          groupId,
          restBetweenSetsSec: 0,
          sets: [{ reps: { kind: 'fixed', value: 10 } }],
        },
        {
          exerciseId: 'b',
          order: 1,
          groupId,
          restBetweenSetsSec: 0,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
        },
      ],
    })

    expect(getNextWorkoutPosition(d, 0, 0)).toMatchObject({
      next: { exerciseIndex: 1, setIndex: 0 },
      restSec: 0,
    })
    expect(getNextWorkoutPosition(d, 1, 0)).toMatchObject({
      next: { exerciseIndex: 0, setIndex: 1 },
      restSec: 20,
    })
    expect(getNextWorkoutPosition(d, 1, 1)).toMatchObject({
      dayComplete: true,
    })
  })
})
