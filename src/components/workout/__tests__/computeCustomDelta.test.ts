import { describe, expect, it } from 'vitest'
import { computeCustomDelta } from '@/components/workout/ActiveCustomWorkoutScreen'

describe('computeCustomDelta', () => {
  it('computes reps delta for reps metric', () => {
    expect(computeCustomDelta({ reps: 12 }, { reps: 10 }, 'reps')).toBe(2)
    expect(computeCustomDelta({ reps: 8 }, { reps: 10 }, 'reps')).toBe(-2)
    expect(computeCustomDelta({ reps: 10 }, { reps: 10 }, 'reps')).toBe(0)
  })

  it('computes reps delta for reps_weight metric (uses reps)', () => {
    expect(computeCustomDelta({ reps: 12, weightKg: 50 }, { reps: 10, weightKg: 40 }, 'reps_weight')).toBe(2)
  })

  it('computes duration delta for duration_sec metric', () => {
    expect(computeCustomDelta({ durationSec: 45 }, { durationSec: 30 }, 'duration_sec')).toBe(15)
    expect(computeCustomDelta({ durationSec: 25 }, { durationSec: 30 }, 'duration_sec')).toBe(-5)
  })

  it('returns null when current reps is missing', () => {
    expect(computeCustomDelta({}, { reps: 10 }, 'reps')).toBeNull()
  })

  it('returns null when previous reps is missing', () => {
    expect(computeCustomDelta({ reps: 10 }, {}, 'reps')).toBeNull()
  })

  it('returns null when current durationSec is missing', () => {
    expect(computeCustomDelta({}, { durationSec: 30 }, 'duration_sec')).toBeNull()
  })

  it('returns null when previous durationSec is missing', () => {
    expect(computeCustomDelta({ durationSec: 30 }, {}, 'duration_sec')).toBeNull()
  })

  it('handles null weightKg gracefully (uses reps for reps_weight)', () => {
    expect(computeCustomDelta({ reps: 10, weightKg: null }, { reps: 8, weightKg: null }, 'reps_weight')).toBe(2)
  })
})
