import { describe, expect, it } from 'vitest'
import type { CustomPlan } from '@/lib/exercise-model'
import {
  applyProgressionToPlan,
  shouldApplyDeload,
} from '@/lib/custom-progression'

const basePlan: CustomPlan = {
  id: 'p1',
  name: 'Test',
  description: '',
  status: 'active',
  source: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  progression: {
    enabled: true,
    afterCycleComplete: true,
    repsDelta: 2,
  },
  deload: {
    enabled: true,
    everyNCycles: 4,
    repsDelta: -2,
  },
  days: [
    {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'a',
          order: 0,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 10 } }],
          progression: { enabled: true, afterCycleComplete: true, repsDelta: 5 },
        },
        {
          exerciseId: 'b',
          order: 1,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
        },
      ],
    },
  ],
}

describe('custom-progression phase 4', () => {
  it('detects deload cycles', () => {
    expect(shouldApplyDeload(basePlan, 3)).toBe(false)
    expect(shouldApplyDeload(basePlan, 4)).toBe(true)
  })

  it('uses per-exercise progression override', () => {
    const next = applyProgressionToPlan(basePlan, basePlan.progression!, { nextCycleAttempt: 2 })
    expect(next.days[0]!.exercises[0]!.sets[0]!.reps).toEqual({ kind: 'fixed', value: 15 })
    expect(next.days[0]!.exercises[1]!.sets[0]!.reps).toEqual({ kind: 'fixed', value: 10 })
  })

  it('applies deload instead of progression on deload cycle', () => {
    const next = applyProgressionToPlan(basePlan, basePlan.progression!, { nextCycleAttempt: 4 })
    expect(next.days[0]!.exercises[0]!.sets[0]!.reps).toEqual({ kind: 'fixed', value: 8 })
    expect(next.days[0]!.exercises[1]!.sets[0]!.reps).toEqual({ kind: 'fixed', value: 6 })
  })
})
