import { describe, expect, it } from 'vitest'
import {
  createEmptyDraftPlan,
  isEmptyOrphanDraft,
  shouldPersistDraft,
} from '@/lib/custom-plan-service'

describe('custom plan draft helpers', () => {
  it('shouldPersistDraft is false for empty new draft', () => {
    const plan = createEmptyDraftPlan()
    expect(shouldPersistDraft(plan)).toBe(false)
    expect(isEmptyOrphanDraft(plan)).toBe(true)
  })

  it('shouldPersistDraft is true when named', () => {
    const plan = { ...createEmptyDraftPlan(), name: 'Full body' }
    expect(shouldPersistDraft(plan)).toBe(true)
    expect(isEmptyOrphanDraft(plan)).toBe(false)
  })

  it('shouldPersistDraft is true when description only', () => {
    const plan = { ...createEmptyDraftPlan(), description: 'Notatka trenera' }
    expect(shouldPersistDraft(plan)).toBe(true)
    expect(isEmptyOrphanDraft(plan)).toBe(false)
  })

  it('shouldPersistDraft is true when progression enabled', () => {
    const plan = {
      ...createEmptyDraftPlan(),
      progression: {
        enabled: true,
        afterCycleComplete: true,
        repsDelta: 2,
      },
    }
    expect(shouldPersistDraft(plan)).toBe(true)
  })

  it('shouldPersistDraft is true when exercise added', () => {
    const plan = createEmptyDraftPlan()
    plan.days[0]!.exercises.push({
      exerciseId: 'ex1',
      order: 0,
      restBetweenSetsSec: 90,
      sets: [{ reps: { kind: 'fixed', value: 8 } }],
    })
    expect(shouldPersistDraft(plan)).toBe(true)
  })
})
