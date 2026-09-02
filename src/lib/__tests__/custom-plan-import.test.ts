import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const exercises = { put: vi.fn() }
  const customPlans = { put: vi.fn() }
  return {
    db: {
      exercises,
      customPlans,
      transaction: vi.fn(
        async (_mode: string, _t1: unknown, _t2: unknown, fn: () => Promise<void>) => fn(),
      ),
    },
  }
})

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn(),
  enqueueActiveCustomWorkoutSync: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'gen-id'),
}))

import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { importCustomPlanFromJson } from '@/lib/custom-plan-service'
import { generateId } from '@/lib/utils'

describe('importCustomPlanFromJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    vi.mocked(generateId).mockImplementation(() => `id-${++n}`)
  })

  it('rejects invalid JSON', async () => {
    await expect(importCustomPlanFromJson('not json')).rejects.toThrow()
  })

  it('rejects payload without name or days', async () => {
    await expect(importCustomPlanFromJson(JSON.stringify({ foo: 1 }))).rejects.toThrow()
  })

  it('imports embedded exercises, progression and deload', async () => {
    const payload = {
      name: 'Test seed',
      description: 'Opis',
      progression: {
        enabled: true,
        afterCycleComplete: true,
        repsDelta: 1,
        durationSecDelta: 5,
      },
      deload: { enabled: true, everyNCycles: 4, repsDelta: -2 },
      exercises: [
        {
          id: 'ex-1',
          name: 'Pompki',
          primaryMetric: 'reps',
          restDefaultSec: 90,
        },
      ],
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [
            {
              exerciseId: 'ex-1',
              order: 0,
              restBetweenSetsSec: 90,
              sets: [{ reps: { kind: 'fixed', value: 8 } }],
            },
          ],
        },
      ],
    }

    const plan = await importCustomPlanFromJson(JSON.stringify(payload))
    expect(plan.status).toBe('draft')
    expect(plan.source).toBe('import')
    expect(plan.progression?.enabled).toBe(true)
    expect(plan.deload?.enabled).toBe(true)
    expect(plan.days[0]?.exercises[0]?.exerciseId).not.toBe('ex-1')
    expect(db.exercises.put).toHaveBeenCalled()
    expect(db.customPlans.put).toHaveBeenCalled()
    expect(enqueueSync).toHaveBeenCalledWith('user_exercises', 'insert', expect.any(Object))
    expect(enqueueSync).toHaveBeenCalledWith('custom_plans', 'insert', expect.any(Object))
  })
})
