import { describe, expect, it } from 'vitest'
import {
  validateCustomPlan,
  validateExerciseDefinition,
  validateSetLog,
  isVolumeProgress,
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

  describe('isVolumeProgress', () => {
    it('returns true when reps below target but volume >= target volume', () => {
      // Target: 10 reps @ 20kg (volume 200), actual: 8 reps @ 30kg (volume 240)
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 }, weightKg: { kind: 'fixed', value: 20 } },
          { reps: 8, weightKg: 30 },
          'reps_weight',
        ),
      ).toBe(true)
    })

    it('returns false when reps below target and volume below target', () => {
      // Target: 10 reps @ 20kg (volume 200), actual: 5 reps @ 30kg (volume 150)
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 }, weightKg: { kind: 'fixed', value: 20 } },
          { reps: 5, weightKg: 30 },
          'reps_weight',
        ),
      ).toBe(false)
    })

    it('returns false when reps meet target (normal pass)', () => {
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 }, weightKg: { kind: 'fixed', value: 20 } },
          { reps: 10, weightKg: 20 },
          'reps_weight',
        ),
      ).toBe(false)
    })

    it('returns false when weight did not increase above target', () => {
      // Target: 10 reps @ 20kg (volume 200), actual: 11 reps @ 20kg (volume 220)
      // Volume >= target but weight same — this is a normal pass (reps met) or
      // if reps below: not volume progress because weight didn't go up.
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 12 }, weightKg: { kind: 'fixed', value: 20 } },
          { reps: 11, weightKg: 20 },
          'reps_weight',
        ),
      ).toBe(false)
    })

    it('returns false for non-reps_weight metrics', () => {
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 } },
          { reps: 8 },
          'reps',
        ),
      ).toBe(false)
    })

    it('returns false when prescription has no weight target', () => {
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 } },
          { reps: 8, weightKg: 30 },
          'reps_weight',
        ),
      ).toBe(false)
    })

    it('returns false when actual weight is missing', () => {
      expect(
        isVolumeProgress(
          { reps: { kind: 'fixed', value: 10 }, weightKg: { kind: 'fixed', value: 20 } },
          { reps: 8 },
          'reps_weight',
        ),
      ).toBe(false)
    })
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
