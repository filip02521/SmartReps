import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ExerciseDefinition, ExerciseLog } from '@/lib/exercise-model'
import type { LocalCustomPlan, LocalWorkoutSession } from '@/lib/db'

const sessions: LocalWorkoutSession[] = []
const customPlans: LocalCustomPlan[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      toArray: async () => sessions,
    },
    customPlans: {
      toArray: async () => customPlans,
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

import { computeExerciseDetailStats } from '@/lib/custom-exercise-stats'

const exId = 'ex-pushups'
const exercise: ExerciseDefinition = {
  id: exId,
  name: 'Pompki',
  primaryMetric: 'reps',
  restDefaultSec: 90,
  archived: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function repsSession(
  id: string,
  daysAgo: number,
  sets: Array<{ reps: number; target: number; passed: boolean }>,
  dayNumber = 1,
): LocalWorkoutSession {
  const at = new Date(Date.now() - daysAgo * 86400000).toISOString()
  const log: ExerciseLog = {
    exerciseId: exId,
    order: 0,
    sets: sets.map((s, i) => ({
      setNumber: i + 1,
      passed: s.passed,
      actual: { reps: s.reps },
      prescription: { reps: { kind: 'fixed', value: s.target } },
    })),
  }
  return {
    id,
    program: 'custom',
    programKind: 'custom',
    customPlanId: 'plan-1',
    cycleId: 'custom:plan-1',
    cycleAttempt: 1,
    dayNumber,
    status: 'completed',
    passed: true,
    startedAt: at,
    completedAt: at,
    setResults: [],
    exerciseLogs: [log],
  }
}

describe('computeExerciseDetailStats — aggregates', () => {
  beforeEach(() => {
    sessions.length = 0
    customPlans.length = 0
    customPlans.push({
      id: 'plan-1',
      name: 'Plan testowy',
      description: '',
      status: 'active',
      days: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      source: 'user',
    })
  })

  it('sums reps, averages best set, dates the PR, and breaks down the last session', async () => {
    sessions.push(repsSession('s1', 10, [{ reps: 8, target: 8, passed: true }], 1))
    sessions.push(repsSession('s2', 5, [{ reps: 10, target: 8, passed: true }], 2))
    sessions.push(repsSession('s3', 1, [{ reps: 9, target: 8, passed: true }], 3))

    const stats = await computeExerciseDetailStats(exercise)

    expect(stats.sessionCount).toBe(3)
    expect(stats.totalRepsAllTime).toBe(8 + 10 + 9)
    // best sets: 8, 10, 9 → avg = 9
    expect(stats.avgBestPerSession).toBe(9)
    // PR = 10 reps, set in s2 (day 2)
    expect(stats.prReps).toBe(10)
    expect(stats.prDate).toBe(sessions[1]!.completedAt!)
    expect(stats.prSessionLabel).toContain('Dzień 2')
    // load per session = total reps per session
    expect(stats.loadPerSession).toHaveLength(3)
    expect(stats.loadPerSession.map((p) => p.value)).toEqual([8, 10, 9])
    // last session = s3 (most recent), one set of 9 reps vs target 8
    expect(stats.lastSessionSets).toHaveLength(1)
    expect(stats.lastSessionSets[0]!.actualLabel).toBe('9')
    expect(stats.lastSessionSets[0]!.targetLabel).toBe('8')
    expect(stats.lastSessionSets[0]!.passed).toBe(true)
    // all three sessions within 30 days
    expect(stats.sessionsLast30d).toBe(3)
  })

  it('counts only sessions within the last 30 days', async () => {
    sessions.push(repsSession('s1', 40, [{ reps: 8, target: 8, passed: true }]))
    sessions.push(repsSession('s2', 5, [{ reps: 10, target: 8, passed: true }]))

    const stats = await computeExerciseDetailStats(exercise)
    expect(stats.sessionsLast30d).toBe(1)
  })
})
