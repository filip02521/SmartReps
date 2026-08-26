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
})
