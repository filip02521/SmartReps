import { describe, expect, it } from 'vitest'
import { applyProgressionToPlan } from '@/lib/custom-progression'
import type { CustomPlan } from '@/lib/exercise-model'

const plan: CustomPlan = {
  id: 'p1',
  name: 'Test',
  description: '',
  status: 'active',
  source: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  days: [
    {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'e1',
          order: 0,
          restBetweenSetsSec: 90,
          sets: [{ reps: { kind: 'fixed', value: 10 } }],
        },
      ],
    },
  ],
}

describe('custom-progression', () => {
  it('bumps fixed reps after cycle', () => {
    const next = applyProgressionToPlan(plan, {
      enabled: true,
      afterCycleComplete: true,
      repsDelta: 2,
    })
    const reps = next.days[0]!.exercises[0]!.sets[0]!.reps
    expect(reps).toEqual({ kind: 'fixed', value: 12 })
  })

  it('no-ops when disabled', () => {
    const next = applyProgressionToPlan(plan, {
      enabled: false,
      afterCycleComplete: true,
      repsDelta: 5,
    })
    expect(next.days[0]!.exercises[0]!.sets[0]!.reps).toEqual({ kind: 'fixed', value: 10 })
  })
})
