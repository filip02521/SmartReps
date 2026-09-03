import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'

const exercises: ExerciseDefinition[] = []
const sessions: LocalWorkoutSession[] = []

vi.mock('@/lib/db', () => ({
  db: {
    exercises: {
      filter: () => ({
        toArray: async () => exercises.filter((e) => !e.archived),
      }),
    },
    workoutSessions: {
      toArray: async () => sessions,
    },
    maxTests: {
      where: () => ({
        equals: () => ({
          toArray: async () => [],
        }),
      }),
    },
  },
}))

import { computeCustomExercisePrs } from '@/lib/custom-stats'

describe('computeCustomExercisePrs', () => {
  beforeEach(() => {
    exercises.length = 0
    sessions.length = 0
  })

  it('includes sparkline and trend for exercises with history', async () => {
    const exId = 'ex-1'
    const now = new Date().toISOString()
    exercises.push({
      id: exId,
      name: 'Pompki',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })

    const values = [5, 6, 7, 8, 9, 10]
    for (let i = 0; i < values.length; i++) {
      sessions.push({
        id: `s-${i}`,
        program: 'custom',
        customPlanId: 'plan-1',
        cycleId: 'custom:plan-1',
        cycleAttempt: 1,
        dayNumber: 1,
        status: 'completed',
        passed: true,
        startedAt: new Date(Date.now() - (values.length - i) * 86400000).toISOString(),
        completedAt: new Date(Date.now() - (values.length - i) * 86400000).toISOString(),
        setResults: [],
        exerciseLogs: [
          {
            exerciseId: exId,
            order: 0,
            sets: [
              {
                setNumber: 1,
                actual: { reps: values[i]! },
                passed: true,
                prescription: { reps: { kind: 'fixed', value: values[i]! } },
              },
            ],
          },
        ],
      })
    }

    const prs = await computeCustomExercisePrs()
    expect(prs).toHaveLength(1)
    expect(prs[0]!.sessionCount).toBe(6)
    expect(prs[0]!.sparkline).toEqual([5, 6, 7, 8, 9, 10])
    expect(prs[0]!.trend).toBe('up')
    expect(prs[0]!.maxReps).toBe(10)
  })

  it('orders sparkline chronologically even when sessions are out of order', async () => {
    const exId = 'ex-order'
    const now = new Date().toISOString()
    exercises.push({
      id: exId,
      name: 'Dip',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })

    const makeSession = (id: string, dayOffset: number, reps: number): LocalWorkoutSession => ({
      id,
      program: 'custom',
      customPlanId: 'plan-1',
      cycleId: 'custom:plan-1',
      cycleAttempt: 1,
      dayNumber: 1,
      status: 'completed',
      passed: true,
      startedAt: new Date(Date.now() - dayOffset * 86400000).toISOString(),
      completedAt: new Date(Date.now() - dayOffset * 86400000).toISOString(),
      setResults: [],
      exerciseLogs: [
        {
          exerciseId: exId,
          order: 0,
          sets: [
            {
              setNumber: 1,
              actual: { reps },
              passed: true,
              prescription: { reps: { kind: 'fixed', value: reps } },
            },
          ],
        },
      ],
    })

    // Newest first in Dexie-like storage order — sparkline must still be oldest→newest.
    sessions.push(makeSession('s-new', 1, 12), makeSession('s-old', 10, 6), makeSession('s-mid', 5, 9))

    const prs = await computeCustomExercisePrs()
    expect(prs[0]!.sparkline).toEqual([6, 9, 12])
  })
})
