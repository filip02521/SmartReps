import { describe, it, expect } from 'vitest'
import { mapRemoteSetRow } from '@/lib/sync-mappers'

describe('sync-mappers', () => {
  it('maps fixed set rows', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 9,
      min_reps: null,
      actual_reps: 10,
      passed: true,
    })
    expect(row.target.kind).toBe('fixed')
    expect(row.actual).toBe(10)
  })

  it('maps max set rows', () => {
    const row = mapRemoteSetRow({
      set_number: 8,
      target_kind: 'max',
      target_reps: null,
      min_reps: 15,
      actual_reps: 16,
      passed: true,
    })
    expect(row.target.kind).toBe('max')
    if (row.target.kind === 'max') expect(row.target.minReps).toBe(15)
  })

  it('maps exact set rows', () => {
    const row = mapRemoteSetRow({
      set_number: 3,
      target_kind: 'exact',
      target_reps: 7,
      min_reps: null,
      actual_reps: 7,
      passed: true,
    })
    expect(row.target.kind).toBe('exact')
  })

  it('maps RPE/RIR/note from metrics_json', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
      metrics_json: { rpe: 7, rir: null, note: 'Felt strong' },
    })
    expect(row.rpe).toBe(7)
    expect(row.rir).toBeUndefined()
    expect(row.note).toBe('Felt strong')
  })

  it('maps RIR when RPE is null', () => {
    const row = mapRemoteSetRow({
      set_number: 2,
      target_kind: 'fixed',
      target_reps: 8,
      min_reps: null,
      actual_reps: 8,
      passed: true,
      metrics_json: { rpe: null, rir: 3, note: null },
    })
    expect(row.rpe).toBeUndefined()
    expect(row.rir).toBe(3)
    expect(row.note).toBeUndefined()
  })

  it('omits RPE/RIR/note when metrics_json is null', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
      metrics_json: null,
    })
    expect(row.rpe).toBeUndefined()
    expect(row.rir).toBeUndefined()
    expect(row.note).toBeUndefined()
  })

  it('omits RPE/RIR/note when metrics_json is undefined (legacy rows)', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
    })
    expect(row.rpe).toBeUndefined()
    expect(row.rir).toBeUndefined()
    expect(row.note).toBeUndefined()
  })

  it('ignores non-numeric RPE and empty note', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
      // Simulate corrupted/legacy data where RPE/RIR might be strings
      metrics_json: { rpe: 'high', rir: 'lots', note: '' },
    })
    expect(row.rpe).toBeUndefined()
    expect(row.rir).toBeUndefined()
    expect(row.note).toBeUndefined()
  })

  it('rejects out-of-bounds RPE and RIR from corrupt remote data', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
      // RPE must be 1-10, RIR must be 0-10; corrupt values must be ignored
      metrics_json: { rpe: 15, rir: -3, note: 'ok' },
    })
    expect(row.rpe).toBeUndefined()
    expect(row.rir).toBeUndefined()
    expect(row.note).toBe('ok')
  })

  it('accepts boundary RPE and RIR values', () => {
    const row = mapRemoteSetRow({
      set_number: 1,
      target_kind: 'fixed',
      target_reps: 10,
      min_reps: null,
      actual_reps: 10,
      passed: true,
      metrics_json: { rpe: 1, rir: 10, note: null },
    })
    expect(row.rpe).toBe(1)
    expect(row.rir).toBe(10)
  })
})
