import { describe, expect, it } from 'vitest'
import {
  customSessionHasProgress,
  appendFailedSetLog,
} from '@/lib/custom-session-service'
import type { ExerciseLog, SetLog } from '@/lib/exercise-model'

describe('custom-session-service helpers', () => {
  it('customSessionHasProgress is false for empty logs', () => {
    const logs: ExerciseLog[] = [
      { exerciseId: 'a', order: 0, sets: [] },
      { exerciseId: 'b', order: 1, sets: [] },
    ]
    expect(customSessionHasProgress(logs)).toBe(false)
  })

  it('customSessionHasProgress is true when any set logged', () => {
    const logs: ExerciseLog[] = [
      { exerciseId: 'a', order: 0, sets: [] },
      {
        exerciseId: 'b',
        order: 1,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 8 },
            prescription: { reps: { kind: 'fixed', value: 8 } },
          },
        ],
      },
    ]
    expect(customSessionHasProgress(logs)).toBe(true)
  })

  it('appendFailedSetLog adds failed set to exercise log', () => {
    const logs: ExerciseLog[] = [{ exerciseId: 'a', order: 0, sets: [] }]
    const fail: SetLog = {
      setNumber: 1,
      passed: false,
      actual: { reps: 4 },
      prescription: { reps: { kind: 'fixed', value: 8 } },
    }
    const next = appendFailedSetLog(logs, 0, 'a', 0, fail)
    expect(next[0]!.sets).toHaveLength(1)
    expect(next[0]!.sets[0]!.passed).toBe(false)
  })
})
