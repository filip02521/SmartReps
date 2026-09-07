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

  it('computeCustomSessionDetail formats minutes when exercise has min unit', () => {
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'cardio',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { durationSec: 2400 },
            prescription: {},
          },
        ],
      },
    ]
    const exerciseMap = new Map([
      ['cardio', { id: 'cardio', name: 'Schody', primaryMetric: 'duration_sec', durationDisplayUnit: 'min', restDefaultSec: 60, archived: false, createdAt: '', updatedAt: '' }],
    ])
    expect(computeCustomSessionDetail(logs, exerciseMap as any)).toBe('40 min')
  })

  it('formatCustomSessionSummary omits empty detail', () => {
    expect(formatCustomSessionSummary(2, 4, '')).toBe('2 ćw. · 4 serie')
  })
})
