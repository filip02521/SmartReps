/**
 * workout-store undo/set semantics — regression for the retry exploit where
 * undoing a PASSED set restored failedRetryUsed and handed back a consumed
 * retry on a later set.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkoutStore } from '@/stores/workout-store'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

const program = 'pushups' as Program

function draft(setNumber: number, actual = 8): SetResultDraft {
  return { setNumber, target: { kind: 'fixed', reps: actual }, actual, passed: true }
}

beforeEach(() => {
  useWorkoutStore.getState().reset()
  useWorkoutStore.getState().startSession({
    sessionId: 'sess-store-1',
    program,
    cycleId: 'pushups-11-20',
    dayNumber: 1,
    cycleAttempt: 1,
  })
})

describe('completeSet', () => {
  it('dedupes by setNumber (redoing a set replaces, not duplicates)', () => {
    useWorkoutStore.getState().completeSet(draft(1, 8))
    useWorkoutStore.getState().completeSet(draft(1, 10))
    const results = useWorkoutStore.getState().setResults
    expect(results).toHaveLength(1)
    expect(results[0]!.actual).toBe(10)
  })
})

describe('undoLastSet', () => {
  it('returns null when nothing was logged', () => {
    expect(useWorkoutStore.getState().undoLastSet()).toBeNull()
  })

  it('removes the last logged set and rewinds the index', () => {
    useWorkoutStore.getState().completeSet(draft(1, 8))
    useWorkoutStore.getState().completeSet(draft(2, 9))
    const removed = useWorkoutStore.getState().undoLastSet()
    expect(removed?.setNumber).toBe(2)
    const s = useWorkoutStore.getState()
    expect(s.setResults).toHaveLength(1)
    expect(s.currentSetIndex).toBe(1)
  })

  it('does NOT restore failedRetryUsed — undoing a passed set must not hand back a consumed retry', () => {
    const s = useWorkoutStore.getState()
    s.completeSet(draft(1, 8))
    s.setFailedRetryUsed(true) // retry consumed on a later set
    useWorkoutStore.getState().undoLastSet()
    expect(useWorkoutStore.getState().failedRetryUsed).toBe(true)
  })
})
