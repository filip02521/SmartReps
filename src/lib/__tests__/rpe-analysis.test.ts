import { describe, it, expect } from 'vitest'
import {
  analyzeBuiltinProgression,
  analyzeCustomProgression,
  averageRpeFromBuiltinSets,
  averageRirFromBuiltinSets,
  setRpeValue,
  setRirValue,
} from '@/lib/rpe-analysis'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { ExerciseLog } from '@/lib/exercise-model'

function makeBuiltinSet(overrides: Partial<SetResultDraft> = {}): SetResultDraft {
  return {
    setNumber: 1,
    target: { kind: 'fixed', reps: 10 },
    actual: 10,
    passed: true,
    ...overrides,
  }
}

function makeCustomSet(overrides: Partial<ExerciseLog['sets'][number]> = {}): ExerciseLog['sets'][number] {
  return {
    setNumber: 1,
    prescription: { reps: { kind: 'fixed', value: 10 } },
    actual: { reps: 10 },
    passed: true,
    ...overrides,
  }
}

function makeCustomLog(sets: ExerciseLog['sets'][number][]): ExerciseLog {
  return {
    exerciseId: 'ex1',
    order: 0,
    sets,
  }
}

describe('rpe-analysis — helpers', () => {
  it('extracts RPE from builtin set', () => {
    expect(setRpeValue(makeBuiltinSet({ rpe: 7 }))).toBe(7)
  })

  it('converts RIR to RPE when RPE is absent', () => {
    expect(setRpeValue(makeBuiltinSet({ rir: 3 }))).toBe(7)
  })

  it('returns null when no effort data', () => {
    expect(setRpeValue(makeBuiltinSet())).toBeNull()
  })

  it('extracts RIR from builtin set', () => {
    expect(setRirValue(makeBuiltinSet({ rir: 3 }))).toBe(3)
  })

  it('converts RPE to RIR when RIR is absent', () => {
    expect(setRirValue(makeBuiltinSet({ rpe: 7 }))).toBe(3)
  })

  it('averages RPE across sets', () => {
    const sets = [makeBuiltinSet({ rpe: 7 }), makeBuiltinSet({ rpe: 8 }), makeBuiltinSet({ rpe: 9 })]
    expect(averageRpeFromBuiltinSets(sets)).toBe(8)
  })

  it('returns null when no sets have RPE', () => {
    const sets = [makeBuiltinSet(), makeBuiltinSet()]
    expect(averageRpeFromBuiltinSets(sets)).toBeNull()
  })

  it('averages RIR across sets', () => {
    const sets = [makeBuiltinSet({ rir: 2 }), makeBuiltinSet({ rir: 3 })]
    expect(averageRirFromBuiltinSets(sets)).toBe(2.5)
  })
})

describe('rpe-analysis — analyzeBuiltinProgression', () => {
  it('returns null when no RPE/RIR data', () => {
    const sets = [makeBuiltinSet(), makeBuiltinSet()]
    expect(analyzeBuiltinProgression(sets, [])).toBeNull()
  })

  it('suggests increase_reps when RPE ≤ 6 sustained', () => {
    const current = [makeBuiltinSet({ setNumber: 1, rpe: 5 }), makeBuiltinSet({ setNumber: 2, rpe: 6 })]
    const recent = [
      [makeBuiltinSet({ rpe: 6 }), makeBuiltinSet({ rpe: 5 })],
      [makeBuiltinSet({ rpe: 5 }), makeBuiltinSet({ rpe: 6 })],
    ]
    const result = analyzeBuiltinProgression(current, recent)
    expect(result?.kind).toBe('increase_reps')
    expect(result?.confidence).toBe('high')
    expect(result?.delta?.reps).toBe(1)
  })

  it('suggests maintain when RPE ≤ 6 but only one session (not sustained)', () => {
    const current = [makeBuiltinSet({ rpe: 5 })]
    const result = analyzeBuiltinProgression(current, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.confidence).toBe('medium')
    expect(result?.reasonKey).toBe('progressionMaintainObserve')
  })

  it('suggests maintain when RPE 7-8 (sweet spot)', () => {
    const current = [makeBuiltinSet({ rpe: 7 }), makeBuiltinSet({ rpe: 8 })]
    const result = analyzeBuiltinProgression(current, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.confidence).toBe('high')
  })

  it('suggests maintain when any set failed', () => {
    const current = [makeBuiltinSet({ rpe: 5, passed: false })]
    const result = analyzeBuiltinProgression(current, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.reasonKey).toBe('progressionMaintainFailedSet')
  })

  it('suggests reduce_volume when RPE 9 sustained across sessions', () => {
    const current = [makeBuiltinSet({ rpe: 9 })]
    const recent = [
      [makeBuiltinSet({ rpe: 9 })],
      [makeBuiltinSet({ rpe: 9 })],
    ]
    const result = analyzeBuiltinProgression(current, recent)
    expect(result?.kind).toBe('reduce_volume')
    expect(result?.delta?.volumePct).toBe(20)
    expect(result?.confidence).toBe('high')
  })

  it('suggests maintain when RPE 9 but not sustained', () => {
    const current = [makeBuiltinSet({ rpe: 9 })]
    const result = analyzeBuiltinProgression(current, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.reasonKey).toBe('progressionMaintainHard')
  })

  it('suggests deload when RPE 10 sustained across sessions', () => {
    const current = [makeBuiltinSet({ rpe: 10 })]
    const recent = [
      [makeBuiltinSet({ rpe: 10 })],
      [makeBuiltinSet({ rpe: 10 })],
    ]
    const result = analyzeBuiltinProgression(current, recent)
    expect(result?.kind).toBe('deload')
    expect(result?.delta?.volumePct).toBe(40)
  })

  it('suggests maintain when RPE 10 but not sustained (single session)', () => {
    const current = [makeBuiltinSet({ rpe: 10 })]
    const result = analyzeBuiltinProgression(current, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.confidence).toBe('medium')
    expect(result?.reasonKey).toBe('progressionMaintainMaxEffort')
  })

  it('uses RIR when RPE is absent', () => {
    const current = [makeBuiltinSet({ rir: 4 })] // RIR 4 = RPE 6
    const recent = [
      [makeBuiltinSet({ rir: 4 })],
      [makeBuiltinSet({ rir: 4 })],
    ]
    const result = analyzeBuiltinProgression(current, recent)
    expect(result?.kind).toBe('increase_reps')
    expect(result?.avgRir).toBe(4)
  })
})

describe('rpe-analysis — analyzeCustomProgression', () => {
  it('returns null when no RPE/RIR data', () => {
    const logs = [makeCustomLog([makeCustomSet()])]
    expect(analyzeCustomProgression(logs, [])).toBeNull()
  })

  it('suggests maintain when RPE low but only one session (not sustained)', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 5, actual: { reps: 10, weightKg: 50 } })])]
    const result = analyzeCustomProgression(logs, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.reasonKey).toBe('progressionMaintainObserve')
  })

  it('suggests increase_weight for weighted exercises when RPE low and sustained', () => {
    const logs = [makeCustomLog([
      makeCustomSet({ rpe: 5, actual: { reps: 10, weightKg: 50 } }),
    ])]
    const recent = [
      [makeCustomLog([makeCustomSet({ rpe: 6, actual: { reps: 10, weightKg: 50 } })])],
      [makeCustomLog([makeCustomSet({ rpe: 6, actual: { reps: 10, weightKg: 50 } })])],
    ]
    const result = analyzeCustomProgression(logs, recent)
    expect(result?.kind).toBe('increase_weight')
    expect(result?.delta?.weightKg).toBe(2.5)
    expect(result?.confidence).toBe('high')
  })

  it('suggests increase_reps for bodyweight exercises when RPE low and sustained', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 5, actual: { reps: 10 } })])]
    const recent = [
      [makeCustomLog([makeCustomSet({ rpe: 6, actual: { reps: 10 } })])],
      [makeCustomLog([makeCustomSet({ rpe: 6, actual: { reps: 10 } })])],
    ]
    const result = analyzeCustomProgression(logs, recent)
    expect(result?.kind).toBe('increase_reps')
    expect(result?.delta?.reps).toBe(1)
    expect(result?.confidence).toBe('high')
  })

  it('suggests maintain when RPE 7-8', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 7 })])]
    const result = analyzeCustomProgression(logs, [])
    expect(result?.kind).toBe('maintain')
  })

  it('suggests maintain when any set failed', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 5, passed: false })])]
    const result = analyzeCustomProgression(logs, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.reasonKey).toBe('progressionMaintainFailedSet')
  })

  it('suggests deload when RPE 10 sustained across sessions', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 10 })])]
    const recent = [
      [makeCustomLog([makeCustomSet({ rpe: 10 })])],
      [makeCustomLog([makeCustomSet({ rpe: 10 })])],
    ]
    const result = analyzeCustomProgression(logs, recent)
    expect(result?.kind).toBe('deload')
  })

  it('suggests maintain when RPE 10 but not sustained (single session)', () => {
    const logs = [makeCustomLog([makeCustomSet({ rpe: 10 })])]
    const result = analyzeCustomProgression(logs, [])
    expect(result?.kind).toBe('maintain')
    expect(result?.reasonKey).toBe('progressionMaintainMaxEffort')
  })
})
