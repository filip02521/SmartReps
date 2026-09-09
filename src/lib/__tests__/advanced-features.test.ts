import { describe, it, expect } from 'vitest'
import {
  estimate1rm,
  estimate1rmEpley,
  estimate1rmBrzycki,
  rpeToRir,
  rirToRpe,
  setVolume,
  type SetLog,
  type SetActual,
  type SetPrescription,
} from '@/lib/exercise-model'

describe('estimate1rm', () => {
  it('returns 0 for zero or negative weight', () => {
    expect(estimate1rm(0, 5)).toBe(0)
    expect(estimate1rm(-10, 5)).toBe(0)
  })

  it('returns 0 for zero or negative reps', () => {
    expect(estimate1rm(80, 0)).toBe(0)
    expect(estimate1rm(80, -1)).toBe(0)
  })

  it('uses Epley for reps <= 10', () => {
    // Epley: 80 * (1 + 5/30) = 80 * 1.1667 = 93.33 → 93
    expect(estimate1rm(80, 5)).toBe(93)
  })

  it('uses Brzycki for 11-36 reps', () => {
    // Brzycki: 60 * 36 / (37 - 12) = 60 * 36 / 25 = 86.4 → 86
    expect(estimate1rm(60, 12)).toBe(86)
  })

  it('falls back to Epley for reps > 36 (Brzycki would divide by zero)', () => {
    // Brzycki returns 0 for reps >= 37, so fall back to Epley
    // Epley: 50 * (1 + 40/30) = 50 * 2.333 = 116.67 → 117
    const result = estimate1rm(50, 40)
    expect(result).toBe(117)
    expect(result).toBeGreaterThan(0)
  })

  it('Epley formula matches known values', () => {
    // 100kg × 1 rep = 100 * (1 + 1/30) = 103.33 → 103
    expect(estimate1rmEpley(100, 1)).toBe(103)
    // 100kg × 10 reps = 100 * (1 + 10/30) = 133.33 → 133
    expect(estimate1rmEpley(100, 10)).toBe(133)
  })

  it('Brzycki formula matches known values', () => {
    // 100kg × 1 rep = 100 * 36 / 36 = 100
    expect(estimate1rmBrzycki(100, 1)).toBe(100)
    // 100kg × 10 reps = 100 * 36 / 27 = 133.33 → 133
    expect(estimate1rmBrzycki(100, 10)).toBe(133)
  })

  it('Brzycki returns 0 for reps >= 37', () => {
    expect(estimate1rmBrzycki(100, 37)).toBe(0)
    expect(estimate1rmBrzycki(100, 50)).toBe(0)
  })
})

describe('rpeToRir / rirToRpe', () => {
  it('converts RPE 10 to RIR 0', () => {
    expect(rpeToRir(10)).toBe(0)
  })

  it('converts RPE 7 to RIR 3', () => {
    expect(rpeToRir(7)).toBe(3)
  })

  it('clamps RPE output to 0-10 range', () => {
    expect(rpeToRir(11)).toBe(0) // 10 - 11 = -1, clamped to 0
    expect(rpeToRir(0)).toBe(10) // 10 - 0 = 10
  })

  it('converts RIR 0 to RPE 10', () => {
    expect(rirToRpe(0)).toBe(10)
  })

  it('converts RIR 3 to RPE 7', () => {
    expect(rirToRpe(3)).toBe(7)
  })

  it('clamps RIR to 1-10 RPE range', () => {
    expect(rirToRpe(15)).toBe(1)  // 10 - 15 = -5, clamped to 1
    expect(rirToRpe(-5)).toBe(10) // 10 - (-5) = 15, clamped to 10
  })
})

describe('setVolume', () => {
  const makeSet = (reps?: number, weightKg?: number | null, durationSec?: number): SetLog => {
    const actual: SetActual = {}
    if (reps != null) actual.reps = reps
    if (weightKg !== undefined) actual.weightKg = weightKg
    if (durationSec != null) actual.durationSec = durationSec
    const prescription: SetPrescription = { reps: { kind: 'fixed', value: reps ?? 0 } }
    return { setNumber: 1, actual, passed: true, prescription }
  }

  it('calculates volume for weighted reps', () => {
    expect(setVolume(makeSet(10, 80))).toBe(800)
  })

  it('returns 0 when weight is 0 or null', () => {
    expect(setVolume(makeSet(10, 0))).toBe(0)
    expect(setVolume(makeSet(10, null))).toBe(0)
  })

  it('returns 0 when reps is 0 or undefined', () => {
    expect(setVolume(makeSet(0, 80))).toBe(0)
    expect(setVolume(makeSet(undefined, 80))).toBe(0)
  })
})

describe('SetLog with rpe/rir/note', () => {
  it('accepts optional rpe field', () => {
    const log: SetLog = {
      setNumber: 1,
      actual: { reps: 10, weightKg: 80 },
      passed: true,
      prescription: { reps: { kind: 'fixed', value: 10 } },
      rpe: 8,
    }
    expect(log.rpe).toBe(8)
    expect(log.rir).toBeUndefined()
  })

  it('accepts optional rir field', () => {
    const log: SetLog = {
      setNumber: 1,
      actual: { reps: 10, weightKg: 80 },
      passed: true,
      prescription: { reps: { kind: 'fixed', value: 10 } },
      rir: 2,
    }
    expect(log.rir).toBe(2)
    expect(log.rpe).toBeUndefined()
  })

  it('accepts optional note field', () => {
    const log: SetLog = {
      setNumber: 1,
      actual: { reps: 10, weightKg: 80 },
      passed: true,
      prescription: { reps: { kind: 'fixed', value: 10 } },
      note: 'Felt easy',
    }
    expect(log.note).toBe('Felt easy')
  })

  it('works without optional fields (backward compatibility)', () => {
    const log: SetLog = {
      setNumber: 1,
      actual: { reps: 10, weightKg: 80 },
      passed: true,
      prescription: { reps: { kind: 'fixed', value: 10 } },
    }
    expect(log.rpe).toBeUndefined()
    expect(log.rir).toBeUndefined()
    expect(log.note).toBeUndefined()
  })
})
