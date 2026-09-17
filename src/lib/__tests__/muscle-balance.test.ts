import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { setDrafts } from './test-fixtures'

const sessions: LocalWorkoutSession[] = []
const exercises: ExerciseDefinition[] = []

vi.mock('@/lib/db', () => ({
  db: {
    exercises: {
      toArray: async () => exercises,
    },
  },
}))

vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: (s: LocalWorkoutSession) => s.program === 'custom',
}))

import { computeMuscleBalance } from '@/lib/muscle-balance'

beforeEach(() => {
  sessions.length = 0
  exercises.length = 0
})

describe('computeMuscleBalance', () => {
  it('returns all groups as none when no sessions', () => {
    const balance = computeMuscleBalance(sessions, exercises, 4)
    expect(balance).toHaveLength(7)
    expect(balance.every((b) => b.status === 'none')).toBe(true)
  })

  it('classifies builtin pushups as chest', () => {
    const now = new Date().toISOString()
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: now,
      completedAt: now,
      passed: true,
      totalReps: 50,
      setResults: setDrafts([25, 25]),
    })
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const chest = balance.find((b) => b.muscleGroup === 'chest')
    expect(chest).toBeDefined()
    expect(chest!.weeklySets).toBeGreaterThan(0)
  })

  it('classifies custom exercise by muscleGroup', () => {
    exercises.push({
      id: 'ex1',
      name: 'Squat',
      primaryMetric: 'reps',
      muscleGroup: 'legs',
      archived: false,
    } as ExerciseDefinition)
    const now = new Date().toISOString()
    sessions.push({
      id: 's1',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'p1',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: now,
      completedAt: now,
      passed: true,
      exerciseLogs: [
        { exerciseId: 'ex1', order: 0, sets: [{ setNumber: 1, actual: { reps: 10 }, passed: true, prescription: { reps: { kind: 'fixed', value: 10 } } }] },
      ],
      setResults: [],
    })
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const legs = balance.find((b) => b.muscleGroup === 'legs')
    expect(legs).toBeDefined()
    expect(legs!.weeklySets).toBeGreaterThan(0)
  })

  it('marks optimal when ≥10 sets/week', () => {
    const now = new Date().toISOString()
    // 40 sets in 4 weeks = 10 sets/week
    for (let i = 0; i < 10; i++) {
      sessions.push({
        id: `s${i}`,
        program: 'pushups',
        cycleId: 'c1',
        dayNumber: 1,
        cycleAttempt: 1,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        passed: true,
        totalReps: 50,
        setResults: setDrafts([25, 25, 25, 25]),
      })
    }
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const chest = balance.find((b) => b.muscleGroup === 'chest')
    expect(chest!.status).toBe('optimal')
  })

  it('ignores sessions outside window', () => {
    const oldDate = new Date(Date.now() - 60 * 86400000).toISOString() // 60 days ago
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: oldDate,
      completedAt: oldDate,
      passed: true,
      totalReps: 50,
      setResults: setDrafts([25]),
    })
    const balance = computeMuscleBalance(sessions, exercises, 4)
    expect(balance.every((b) => b.status === 'none')).toBe(true)
  })

  it('counts exercises without a muscleGroup under other', () => {
    exercises.push({
      id: 'ex1',
      name: 'Custom move',
      primaryMetric: 'reps',
      archived: false,
    } as ExerciseDefinition)
    const now = new Date().toISOString()
    sessions.push({
      id: 's1',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'p1',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: now,
      completedAt: now,
      passed: true,
      exerciseLogs: [
        { exerciseId: 'ex1', order: 0, sets: [{ setNumber: 1, actual: { reps: 10 }, passed: true, prescription: { reps: { kind: 'fixed', value: 10 } } }] },
      ],
      setResults: [],
    })
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const other = balance.find((b) => b.muscleGroup === 'other')
    expect(other).toBeDefined()
    expect(other!.weeklySets).toBeGreaterThan(0)
  })

  it('normalizes the weekly rate over the observed span for new users', () => {
    // First-ever session 3 days ago: 15 chest sets must not be divided by 4.
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: threeDaysAgo,
      completedAt: threeDaysAgo,
      passed: true,
      totalReps: 150,
      setResults: setDrafts([30, 30, 30, 30, 30]),
    })
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const chest = balance.find((b) => b.muscleGroup === 'chest')
    expect(chest!.weeklySets).toBe(5)
  })

  it('keeps the full window divisor once history spans it', () => {
    // Sessions spanning 3+ weeks: 20 chest sets → 20 / ceil(span) — still
    // uses the observed span, capped at `weeks`.
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString()
    const now = new Date().toISOString()
    for (const [i, startedAt] of [twentyDaysAgo, now].entries()) {
      sessions.push({
        id: `s${i}`,
        program: 'pushups',
        cycleId: 'c1',
        dayNumber: 1,
        cycleAttempt: 1,
        status: 'completed',
        startedAt,
        completedAt: startedAt,
        passed: true,
        totalReps: 100,
        setResults: setDrafts([25, 25, 25, 25]),
      })
    }
    const balance = computeMuscleBalance(sessions, exercises, 4)
    const chest = balance.find((b) => b.muscleGroup === 'chest')
    // span = 20 days → 3 weeks → 8 sets / 3 ≈ 2.7
    expect(chest!.weeklySets).toBeCloseTo(2.7, 1)
  })
})
