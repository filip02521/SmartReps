import { describe, expect, it } from 'vitest'
import {
  validateCustomPlan,
  validateExerciseDefinition,
  validateSetLog,
  type CustomPlan,
  type ExerciseDefinition,
} from '@/lib/exercise-model'
import { getDayPlan, resolveBuiltin } from '@/lib/plan-resolver'

const now = '2026-01-01T00:00:00.000Z'

function makeExercise(partial?: Partial<ExerciseDefinition>): ExerciseDefinition {
  return {
    id: 'ex-1',
    name: 'Deska',
    primaryMetric: 'duration_sec',
    restDefaultSec: 60,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

describe('exercise-model', () => {
  it('rejects empty exercise name', () => {
    const issues = validateExerciseDefinition(makeExercise({ name: '  ' }))
    expect(issues.some((i) => i.path === 'name')).toBe(true)
  })

  it('validates duration set log', () => {
    expect(
      validateSetLog(
        { durationSec: { kind: 'min', value: 30 } },
        { durationSec: 45 },
        'duration_sec',
      ),
    ).toBe(true)
    expect(
      validateSetLog(
        { durationSec: { kind: 'min', value: 30 } },
        { durationSec: 20 },
        'duration_sec',
      ),
    ).toBe(false)
  })

  it('requires weight for reps_weight metric only when prescription specifies weight', () => {
    // Without prescription weightKg, bodyweight reps_weight is valid (no weight needed)
    expect(
      validateSetLog(
        { reps: { kind: 'fixed', value: 8 } },
        { reps: 8 },
        'reps_weight',
      ),
    ).toBe(true)
    // With prescription weightKg, actual weight is required
    expect(
      validateSetLog(
        { reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 20 } },
        { reps: 8 },
        'reps_weight',
      ),
    ).toBe(false)
    expect(
      validateSetLog(
        { reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 20 } },
        { reps: 8, weightKg: 20 },
        'reps_weight',
      ),
    ).toBe(true)
  })

  it('validates custom plan with known exercises', () => {
    const ex = makeExercise({ id: 'ex-1', primaryMetric: 'reps', name: 'Pompki' })
    const plan: CustomPlan = {
      id: 'plan-1',
      name: 'Test',
      description: '',
      status: 'draft',
      source: 'user',
      createdAt: now,
      updatedAt: now,
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [
            {
              exerciseId: 'ex-1',
              order: 0,
              restBetweenSetsSec: 90,
              sets: [{ reps: { kind: 'fixed', value: 10 } }],
            },
          ],
        },
      ],
    }
    expect(validateCustomPlan(plan, new Map([[ex.id, ex]]))).toEqual([])
  })
})

describe('plan-resolver', () => {
  it('maps builtin day to single planned exercise', () => {
    const ctx = resolveBuiltin('pushups', 'pushups-ponizej-5')
    expect(ctx).not.toBeNull()
    const day = getDayPlan(ctx!, 1)
    expect(day?.exercises).toHaveLength(1)
    expect(day?.exercises[0]?.sets.length).toBeGreaterThan(0)
    expect(day?.exercises[0]?.exerciseId).toBe('builtin:pushups')
  })
})
