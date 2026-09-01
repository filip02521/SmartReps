import { describe, expect, it } from 'vitest'
import { getRestNextSetLabel } from '@/lib/workout-rest-label'
import type { SetTarget } from '@/data/plans/types'

const sets: SetTarget[] = [
  { kind: 'fixed', reps: 5 },
  { kind: 'fixed', reps: 7 },
  { kind: 'fixed', reps: 9 },
  { kind: 'fixed', reps: 11 },
  { kind: 'max', minReps: 15 },
]

describe('getRestNextSetLabel', () => {
  it('shows the immediate next set during rest (not +2)', () => {
    // After set 1 done, completeSet() leaves currentSetIndex at 1 (set 2).
    expect(getRestNextSetLabel(1, sets, 'pompek', true)).toBe('Następnie: Seria 2 · 7 pompek')
  })

  it('returns empty when not resting', () => {
    expect(getRestNextSetLabel(1, sets, 'pompek', false)).toBe('')
  })

  it('returns empty when no next set exists', () => {
    expect(getRestNextSetLabel(5, sets, 'pompek', true)).toBe('')
  })
})
