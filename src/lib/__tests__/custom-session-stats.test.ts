import { describe, expect, it } from 'vitest'
import {
  computeCustomSessionDetail,
  formatCustomSessionSummary,
  sessionTotalSets,
} from '@/lib/custom-session-stats'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseLog } from '@/lib/exercise-model'

describe('custom-session-stats', () => {
  it('sessionTotalSets sums exercise log sets', () => {
    const session = {
      exerciseLogs: [
        { exerciseId: 'a', order: 0, sets: [{ setNumber: 1 }] },
        { exerciseId: 'b', order: 1, sets: [{ setNumber: 1 }, { setNumber: 2 }] },
      ],
    } as LocalWorkoutSession
    expect(sessionTotalSets(session)).toBe(3)
  })

  it('computeCustomSessionDetail includes reps, duration and weight', () => {
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'a',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 10, durationSec: 30, weightKg: 20 },
            prescription: {},
          },
        ],
      },
    ]
    expect(computeCustomSessionDetail(logs)).toBe('10 powtórzeń · 30s · 20 kg')
  })

  it('formatCustomSessionSummary omits empty detail', () => {
    expect(formatCustomSessionSummary(2, 4, '')).toBe('2 ćw. · 4 serie')
  })
})
