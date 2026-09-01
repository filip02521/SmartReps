import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'

const sessions = new Map<string, LocalWorkoutSession>()
const byPlan = new Map<string, LocalWorkoutSession[]>()

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      get: async (id: string) => sessions.get(id),
      where: (_field: string) => ({
        equals: (planId: string) => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () => (byPlan.get(planId) ?? []).filter(fn),
          }),
          toArray: async () => byPlan.get(planId) ?? [],
        }),
      }),
    },
  },
}))

import {
  getCustomSessionComparison,
  customSessionTotalReps,
  customSessionTotalDurationSec,
  customSessionPassedSets,
} from '@/lib/custom-session-comparison'

function seed(session: LocalWorkoutSession) {
  sessions.set(session.id, session)
  const planId = session.customPlanId!
  const list = byPlan.get(planId) ?? []
  byPlan.set(planId, [...list.filter((s) => s.id !== session.id), session])
}

describe('getCustomSessionComparison', () => {
  beforeEach(() => {
    sessions.clear()
    byPlan.clear()
  })

  it('returns previous passed session from prior attempt', async () => {
    seed({
      id: 'prev',
      program: 'custom',
      customPlanId: 'p1',
      cycleId: 'custom:p1',
      cycleAttempt: 1,
      dayNumber: 2,
      status: 'completed',
      passed: true,
      startedAt: '2026-01-01T10:00:00Z',
      completedAt: '2026-01-01T10:30:00Z',
      setResults: [],
      exerciseLogs: [],
    })
    seed({
      id: 'cur',
      program: 'custom',
      customPlanId: 'p1',
      cycleId: 'custom:p1',
      cycleAttempt: 2,
      dayNumber: 2,
      status: 'completed',
      passed: true,
      startedAt: '2026-01-02T10:00:00Z',
      completedAt: '2026-01-02T10:30:00Z',
      setResults: [],
      exerciseLogs: [],
    })

    const { current, previous } = await getCustomSessionComparison('p1', 'cur')
    expect(current?.id).toBe('cur')
    expect(previous?.id).toBe('prev')
  })

  it('aggregates reps, duration and passed sets from exercise logs', () => {
    const session: LocalWorkoutSession = {
      id: 's1',
      program: 'custom',
      customPlanId: 'p1',
      cycleId: 'custom:p1',
      cycleAttempt: 1,
      dayNumber: 1,
      status: 'completed',
      passed: true,
      startedAt: '',
      completedAt: '',
      setResults: [],
      exerciseLogs: [
        {
          exerciseId: 'a',
          order: 0,
          sets: [
            {
              setNumber: 1,
              passed: true,
              actual: { reps: 10 },
              prescription: { reps: { kind: 'fixed', value: 8 } },
            },
            {
              setNumber: 2,
              passed: false,
              actual: { reps: 5 },
              prescription: { reps: { kind: 'fixed', value: 8 } },
            },
          ],
        },
      ],
    }
    expect(customSessionTotalReps(session)).toBe(15)
    expect(customSessionTotalDurationSec(session)).toBe(0)
    expect(customSessionPassedSets(session)).toEqual({ passed: 1, total: 2 })
  })
})
