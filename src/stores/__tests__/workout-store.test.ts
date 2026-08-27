import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkoutStore } from '@/stores/workout-store'
import type { SetResultDraft } from '@/lib/progress-engine'

function makeResult(setNumber: number, actual = 10): SetResultDraft {
  return {
    setNumber,
    target: { kind: 'fixed', reps: 10 },
    actual,
    passed: true,
  }
}

describe('workout-store undoLastSet', () => {
  beforeEach(() => {
    useWorkoutStore.getState().reset()
    useWorkoutStore.getState().startSession({
      sessionId: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
    })
  })

  it('returns null when nothing to undo', () => {
    expect(useWorkoutStore.getState().undoLastSet()).toBeNull()
  })

  it('removes last set and moves index back', () => {
    const store = useWorkoutStore.getState()
    store.completeSet(makeResult(1, 12))
    store.setRestTimer({
      mode: 'pill',
      totalSec: 60,
      remainingSec: 60,
      startedAt: Date.now(),
    })

    expect(useWorkoutStore.getState().currentSetIndex).toBe(1)
    expect(useWorkoutStore.getState().setResults).toHaveLength(1)

    const removed = useWorkoutStore.getState().undoLastSet()
    expect(removed?.actual).toBe(12)
    expect(removed?.setNumber).toBe(1)

    const after = useWorkoutStore.getState()
    expect(after.currentSetIndex).toBe(0)
    expect(after.setResults).toHaveLength(0)
    expect(after.restTimer?.mode).toBe('idle')
  })

  it('only undoes the latest completed set', () => {
    const store = useWorkoutStore.getState()
    store.completeSet(makeResult(1, 10))
    store.completeSet(makeResult(2, 11))

    const removed = useWorkoutStore.getState().undoLastSet()
    expect(removed?.setNumber).toBe(2)

    const after = useWorkoutStore.getState()
    expect(after.currentSetIndex).toBe(1)
    expect(after.setResults.map((r) => r.setNumber)).toEqual([1])
  })

  it('completeSet after undo replaces the corrected set', () => {
    const store = useWorkoutStore.getState()
    store.completeSet(makeResult(1, 10))
    useWorkoutStore.getState().undoLastSet()
    useWorkoutStore.getState().completeSet(makeResult(1, 8))

    const after = useWorkoutStore.getState()
    expect(after.currentSetIndex).toBe(1)
    expect(after.setResults).toEqual([expect.objectContaining({ setNumber: 1, actual: 8 })])
  })
})
