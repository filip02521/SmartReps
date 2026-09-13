import { describe, expect, it } from 'vitest'
import type { CustomPlan } from '@/lib/exercise-model'
import {
  PROGRESSION_BOUNDS,
  applyProposalToPlan,
  parseAdaptiveProposal,
  proposalChangesPlan,
  type AdaptiveProposal,
} from '@/lib/ai/adaptive-progression'

function makePlan(overrides: Partial<CustomPlan> = {}): CustomPlan {
  return {
    id: 'plan-1',
    name: 'Test plan',
    description: '',
    status: 'active',
    source: 'user',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    progression: { enabled: true, afterCycleComplete: true, repsDelta: 1 },
    deload: null,
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          {
            exerciseId: 'pushup',
            order: 1,
            sets: [{ reps: { kind: 'fixed', value: 10 } }],
            restBetweenSetsSec: 90,
          },
          {
            exerciseId: 'squat',
            order: 2,
            sets: [{ reps: { kind: 'fixed', value: 15 } }],
            restBetweenSetsSec: 90,
          },
        ],
      },
    ],
    ...overrides,
  }
}

const baseProposal: AdaptiveProposal = {
  enabled: true,
  repsDelta: 2,
  weightKgDelta: null,
  durationSecDelta: null,
  deloadEveryNCycles: null,
  perExercise: [],
  rationale: 'Dobre wyniki — lekka progresja.',
}

describe('parseAdaptiveProposal — validation + clamping', () => {
  it('returns null for non-object or missing rationale', () => {
    const plan = makePlan()
    expect(parseAdaptiveProposal(null, plan)).toBeNull()
    expect(parseAdaptiveProposal('x', plan)).toBeNull()
    expect(parseAdaptiveProposal({ enabled: true }, plan)).toBeNull()
  })

  it('clamps out-of-bound deltas to PROGRESSION_BOUNDS', () => {
    const plan = makePlan()
    const p = parseAdaptiveProposal(
      {
        enabled: true,
        repsDelta: 99,
        weightKgDelta: -500,
        durationSecDelta: 999,
        deloadEveryNCycles: 50,
        rationale: 'test',
      },
      plan,
    )
    expect(p?.repsDelta).toBe(PROGRESSION_BOUNDS.repsDelta.max)
    expect(p?.weightKgDelta).toBe(PROGRESSION_BOUNDS.weightKgDelta.min)
    expect(p?.durationSecDelta).toBe(PROGRESSION_BOUNDS.durationSecDelta.max)
    expect(p?.deloadEveryNCycles).toBe(PROGRESSION_BOUNDS.deloadEveryNCycles.max)
  })

  it('maps non-finite/missing deltas to null', () => {
    const plan = makePlan()
    const p = parseAdaptiveProposal(
      { enabled: true, repsDelta: 'many', weightKgDelta: NaN, rationale: 'ok' },
      plan,
    )
    expect(p?.repsDelta).toBeNull()
    expect(p?.weightKgDelta).toBeNull()
  })

  it('drops per-exercise entries for unknown exercise ids', () => {
    const plan = makePlan()
    const p = parseAdaptiveProposal(
      {
        enabled: true,
        rationale: 'ok',
        perExercise: [
          { exerciseId: 'pushup', repsDelta: 2 },
          { exerciseId: 'nonexistent', repsDelta: 5 },
          { exerciseId: 'squat' }, // all null → dropped
        ],
      },
      plan,
    )
    expect(p?.perExercise).toHaveLength(1)
    expect(p?.perExercise[0]?.exerciseId).toBe('pushup')
  })

  it('null deloadEveryNCycles means disabled', () => {
    const plan = makePlan()
    const p = parseAdaptiveProposal(
      { enabled: true, deloadEveryNCycles: null, rationale: 'ok' },
      plan,
    )
    expect(p?.deloadEveryNCycles).toBeNull()
  })
})

describe('proposalChangesPlan', () => {
  it('detects no change when proposal matches current rules', () => {
    const plan = makePlan()
    const p: AdaptiveProposal = {
      ...baseProposal,
      repsDelta: 1, // same as current
      deloadEveryNCycles: null,
    }
    expect(proposalChangesPlan(plan, p)).toBe(false)
  })

  it('detects changed deltas, deload and per-exercise overrides', () => {
    const plan = makePlan()
    expect(proposalChangesPlan(plan, baseProposal)).toBe(true) // repsDelta 1→2
    expect(
      proposalChangesPlan(plan, { ...baseProposal, repsDelta: 1, deloadEveryNCycles: 4 }),
    ).toBe(true)
    expect(
      proposalChangesPlan(plan, {
        ...baseProposal,
        repsDelta: 1,
        perExercise: [{ exerciseId: 'pushup', repsDelta: 2, weightKgDelta: null, durationSecDelta: null }],
      }),
    ).toBe(true)
  })

  it('detects disabling progression', () => {
    const plan = makePlan()
    expect(proposalChangesPlan(plan, { ...baseProposal, enabled: false })).toBe(true)
  })

  it('null delta = keep current (no change), 0 = explicit clear (change)', () => {
    const plan = makePlan() // current repsDelta: 1
    // AI omits repsDelta → keeps current 1 → no diff
    expect(
      proposalChangesPlan(plan, { ...baseProposal, repsDelta: null }),
    ).toBe(false)
    // AI sends 0 → clears the delta → diff
    expect(
      proposalChangesPlan(plan, { ...baseProposal, repsDelta: 0 }),
    ).toBe(true)
  })

  it('per-exercise null deltas keep existing override fields', () => {
    const plan = makePlan()
    plan.days[0]!.exercises[0]!.progression = {
      enabled: true,
      afterCycleComplete: true,
      repsDelta: 2,
      weightKgDelta: 5,
    }
    // Proposal only touches repsDelta → weightKgDelta: 5 must be kept → no diff
    const p: AdaptiveProposal = {
      ...baseProposal,
      repsDelta: 1,
      perExercise: [
        { exerciseId: 'pushup', repsDelta: 2, weightKgDelta: null, durationSecDelta: null },
      ],
    }
    expect(proposalChangesPlan(plan, p)).toBe(false)
  })
})

describe('applyProposalToPlan', () => {
  it('applies plan-level deltas and deload', () => {
    const plan = makePlan()
    const next = applyProposalToPlan(plan, {
      ...baseProposal,
      repsDelta: 3,
      deloadEveryNCycles: 4,
    })
    expect(next.progression).toEqual({
      enabled: true,
      afterCycleComplete: true,
      repsDelta: 3,
    })
    expect(next.deload).toEqual({ enabled: true, everyNCycles: 4 })
  })

  it('disables progression and deload when proposed', () => {
    const plan = makePlan({ deload: { enabled: true, everyNCycles: 4 } })
    const next = applyProposalToPlan(plan, { ...baseProposal, enabled: false, deloadEveryNCycles: null })
    expect(next.progression?.enabled).toBe(false)
    expect(next.deload?.enabled).toBe(false)
  })

  it('sets per-exercise overrides without touching other exercises', () => {
    const plan = makePlan()
    const next = applyProposalToPlan(plan, {
      ...baseProposal,
      perExercise: [
        { exerciseId: 'pushup', repsDelta: 2, weightKgDelta: null, durationSecDelta: null },
      ],
    })
    const pushup = next.days[0]!.exercises[0]!
    const squat = next.days[0]!.exercises[1]!
    expect(pushup.progression?.repsDelta).toBe(2)
    expect(squat.progression).toBeUndefined()
  })

  it('keeps current delta when proposal omits it; clears on explicit 0', () => {
    const plan = makePlan({
      progression: { enabled: true, afterCycleComplete: true, repsDelta: 1, weightKgDelta: 2.5 },
    })
    const kept = applyProposalToPlan(plan, {
      ...baseProposal,
      repsDelta: 3,
      weightKgDelta: null, // keep 2.5
    })
    expect(kept.progression?.repsDelta).toBe(3)
    expect(kept.progression?.weightKgDelta).toBe(2.5)

    const cleared = applyProposalToPlan(plan, {
      ...baseProposal,
      repsDelta: 0, // explicit clear
      weightKgDelta: null,
    })
    expect(cleared.progression?.repsDelta).toBeUndefined()
    expect(cleared.progression?.weightKgDelta).toBe(2.5)
  })

  it('preserves deload deltas when only everyNCycles changes', () => {
    const plan = makePlan({
      deload: { enabled: true, everyNCycles: 4, repsDelta: -3, weightKgDelta: -10 },
    })
    const next = applyProposalToPlan(plan, { ...baseProposal, deloadEveryNCycles: 6 })
    expect(next.deload).toEqual({
      enabled: true,
      everyNCycles: 6,
      repsDelta: -3,
      weightKgDelta: -10,
    })
  })

  it('clears overrides absent from the proposal', () => {
    const plan = makePlan()
    plan.days[0]!.exercises[0]!.progression = {
      enabled: true,
      afterCycleComplete: true,
      repsDelta: 9,
    }
    const next = applyProposalToPlan(plan, { ...baseProposal, repsDelta: 1, perExercise: [] })
    expect(next.days[0]!.exercises[0]!.progression).toBeNull()
  })

  it('preserves afterCycleComplete choice on both rule levels', () => {
    const plan = makePlan({
      progression: { enabled: true, afterCycleComplete: false, repsDelta: 1 },
    })
    const next = applyProposalToPlan(plan, { ...baseProposal, repsDelta: 2 })
    expect(next.progression?.afterCycleComplete).toBe(false)
  })

  it('does not mutate the original plan', () => {
    const plan = makePlan()
    const before = JSON.stringify(plan)
    applyProposalToPlan(plan, { ...baseProposal, repsDelta: 5 })
    expect(JSON.stringify(plan)).toBe(before)
  })
})
