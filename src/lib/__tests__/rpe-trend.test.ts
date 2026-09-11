import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'

// In-memory store for test sessions
let sessions: LocalWorkoutSession[] = []
let customPlans: { id: string; name: string }[] = []
let exercises: { id: string; name: string }[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: () => ({
        equals: () => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () => sessions.filter(fn),
          }),
        }),
      }),
      filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
        toArray: async () => sessions.filter(fn),
      }),
      clear: async () => {
        sessions = []
      },
      put: async (s: LocalWorkoutSession) => {
        const idx = sessions.findIndex((x) => x.id === s.id)
        if (idx >= 0) sessions[idx] = s
        else sessions.push(s)
      },
    },
    customPlans: {
      toArray: async () => customPlans,
      clear: async () => {
        customPlans = []
      },
    },
    exercises: {
      toArray: async () => exercises,
      clear: async () => {
        exercises = []
      },
    },
  },
}))

import { getBuiltinRpeTrend, hasAnyRpeData } from '@/lib/rpe-trend'

function makeSession(overrides: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    program: 'pushups',
    programKind: 'builtin',
    cycleId: 'cycle-1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2024-01-01T10:00:00.000Z',
    completedAt: '2024-01-01T10:30:00.000Z',
    passed: true,
    totalReps: 30,
    setResults: [],
    ...overrides,
  }
}

describe('rpe-trend', () => {
  beforeEach(() => {
    sessions = []
    customPlans = []
    exercises = []
  })

  it('hasAnyRpeData returns false when no sessions', async () => {
    expect(await hasAnyRpeData()).toBe(false)
  })

  it('hasAnyRpeData returns true when builtin session has RPE', async () => {
    sessions.push(
      makeSession({
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 7 },
        ],
      }),
    )
    expect(await hasAnyRpeData()).toBe(true)
  })

  it('hasAnyRpeData returns false when builtin session has no RPE', async () => {
    sessions.push(
      makeSession({
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
        ],
      }),
    )
    expect(await hasAnyRpeData()).toBe(false)
  })

  it('getBuiltinRpeTrend returns empty when no RPE data', async () => {
    sessions.push(
      makeSession({
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
        ],
      }),
    )
    const groups = await getBuiltinRpeTrend('pushups')
    expect(groups).toHaveLength(0)
  })

  it('getBuiltinRpeTrend groups by day number', async () => {
    sessions.push(
      makeSession({
        id: 's1',
        dayNumber: 1,
        startedAt: '2024-01-01T10:00:00.000Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 7 },
          { setNumber: 2, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 8 },
        ],
      }),
    )
    sessions.push(
      makeSession({
        id: 's2',
        dayNumber: 2,
        startedAt: '2024-01-03T10:00:00.000Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 9 },
        ],
      }),
    )
    const groups = await getBuiltinRpeTrend('pushups')
    expect(groups).toHaveLength(2)
    const day1 = groups.find((g) => g.key === 'pushups-d1')
    expect(day1?.points).toHaveLength(1)
    expect(day1?.points[0]?.avgRpe).toBe(7.5)
    expect(day1?.points[0]?.setCount).toBe(2)
  })

  it('getBuiltinRpeTrend sorts points oldest-first', async () => {
    sessions.push(
      makeSession({
        id: 's1',
        dayNumber: 1,
        startedAt: '2024-01-03T10:00:00.000Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 8 },
        ],
      }),
    )
    sessions.push(
      makeSession({
        id: 's2',
        dayNumber: 1,
        startedAt: '2024-01-01T10:00:00.000Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 6 },
        ],
      }),
    )
    const groups = await getBuiltinRpeTrend('pushups')
    const day1 = groups.find((g) => g.key === 'pushups-d1')
    expect(day1?.points[0]?.date).toBe('2024-01-01')
    expect(day1?.points[1]?.date).toBe('2024-01-03')
  })

  it('getBuiltinRpeTrend limits to last N points', async () => {
    for (let i = 0; i < 5; i++) {
      sessions.push(
        makeSession({
          id: `s${i}`,
          dayNumber: 1,
          startedAt: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
          setResults: [
            { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rpe: 7 },
          ],
        }),
      )
    }
    const groups = await getBuiltinRpeTrend('pushups', 3)
    const day1 = groups.find((g) => g.key === 'pushups-d1')
    expect(day1?.points).toHaveLength(3)
  })

  it('getBuiltinRpeTrend converts RIR to RPE for averaging', async () => {
    sessions.push(
      makeSession({
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true, rir: 3 },
        ],
      }),
    )
    const groups = await getBuiltinRpeTrend('pushups')
    const day1 = groups.find((g) => g.key === 'pushups-d1')
    expect(day1?.points[0]?.avgRpe).toBe(7)
    expect(day1?.points[0]?.avgRir).toBe(3)
  })
})
