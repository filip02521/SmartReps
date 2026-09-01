import { describe, expect, it } from 'vitest'
import type { ExerciseDefinition, PlannedExercise } from '@/lib/exercise-model'
import {
  filterValidDayExercises,
  findFirstMissingExercise,
  replaceExerciseInDay,
  canEditCustomPlanDay,
} from '@/lib/custom-plan-edit-lock'
import type { CustomPlan } from '@/lib/exercise-model'

const exMap = new Map<string, ExerciseDefinition>([
  [
    'a',
    {
      id: 'a',
      name: 'A',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: false,
      createdAt: '',
      updatedAt: '',
    },
  ],
  [
    'b',
    {
      id: 'b',
      name: 'B',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: true,
      createdAt: '',
      updatedAt: '',
    },
  ],
])

const planned = (id: string, order: number): PlannedExercise => ({
  exerciseId: id,
  order,
  sets: [],
  restBetweenSetsSec: 60,
})

describe('custom-plan-edit-lock', () => {
  it('filters archived exercises', () => {
    expect(filterValidDayExercises([planned('a', 0), planned('b', 1)], exMap)).toHaveLength(1)
  })

  it('finds missing exercise', () => {
    expect(findFirstMissingExercise([planned('a', 0), planned('b', 1)], exMap)?.exerciseId).toBe(
      'b',
    )
  })

  it('locks active day only', () => {
    expect(canEditCustomPlanDay(2, 3)).toBe(true)
    expect(canEditCustomPlanDay(2, 2)).toBe(false)
    expect(canEditCustomPlanDay(null, 2)).toBe(true)
  })

  it('replaces missing exercise id in day', () => {
    const plan: CustomPlan = {
      id: 'p1',
      name: 'P',
      description: '',
      status: 'active',
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [planned('old', 0)],
        },
      ],
      createdAt: '',
      updatedAt: '',
      source: 'user',
    }
    const next = replaceExerciseInDay(plan, 1, 'old', 'new')
    expect(next.days[0]!.exercises[0]!.exerciseId).toBe('new')
  })
})
