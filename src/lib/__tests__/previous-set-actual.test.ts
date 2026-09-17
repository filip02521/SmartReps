import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'

let sessions: LocalWorkoutSession[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: (field: keyof LocalWorkoutSession) => ({
        equals: (value: unknown) => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () => sessions.filter((s) => s[field] === value && fn(s)),
          }),
          toArray: async () => sessions.filter((s) => s[field] === value),
        }),
      }),
      get: async (id: string) => sessions.find((s) => s.id === id),
    },
  },
}))

vi.mock('@/lib/program-service', () => ({
  clearActiveWorkout: vi.fn(),
  completeWorkoutDay: vi.fn(),
  markProgramActiveIfReady: vi.fn(),
  saveActiveWorkout: vi.fn(),
}))

vi.mock('@/lib/sync', () => ({ enqueueSync: vi.fn() }))
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvents: {},
  trackSyncError: vi.fn(),
}))
vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: vi.fn(() => ({})) }),
}))

import {
  getMostRecentSetActual,
  getPreviousSetActual,
  getSessionComparison,
} from '@/lib/session-service'
import type { SetResultDraft } from '@/lib/progress-engine'

function sets(actuals: number[]): SetResultDraft[] {
  return actuals.map((actual, i) => ({
    setNumber: i + 1,
    target: { kind: 'exact', reps: actual },
    actual,
    passed: true,
  }))
}

function session(overrides: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2026-01-01T10:00:00.000Z',
    setResults: [],
    ...overrides,
  }
}

beforeEach(() => {
  sessions = []
})

describe('getMostRecentSetActual', () => {
  it('returns the actual from the most recent same-cycle same-day session', async () => {
    sessions = [
      session({ id: 'old', cycleAttempt: 1, startedAt: '2026-01-01T10:00:00.000Z', setResults: sets([8, 8, 8, 8, 10]) }),
      session({ id: 'newer', cycleAttempt: 2, startedAt: '2026-02-01T10:00:00.000Z', setResults: sets([10, 10, 10, 10, 14]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 5)).toBe(14)
  })

  it('uses the most recent same-day session regardless of cycle', async () => {
    // The user compares against their real last time — an older same-cycle
    // session must NOT win over a newer different-cycle one (that produced
    // inflated +deltas when the user actually did fewer reps than last time).
    sessions = [
      session({ id: 'same-cycle-old', cycleAttempt: 1, startedAt: '2026-01-01T10:00:00.000Z', setResults: sets([8, 8, 8]) }),
      session({ id: 'other-cycle-new', cycleId: 'pushups-0-5', dayNumber: 1, startedAt: '2026-02-01T10:00:00.000Z', setResults: sets([30, 30, 30]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 1)).toBe(30)
  })

  it('falls back to the same dayNumber from a different cycle', async () => {
    // New cycle, day 1 — no same-cycle history, so "last time you did day 1"
    // is the previous cycle's day 1. Real numbers, not garbage.
    sessions = [
      session({ id: 'other-cycle', cycleId: 'pushups-0-5', dayNumber: 1, setResults: sets([12, 12, 12]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 1)).toBe(12)
  })

  it('does not fall back to a different day of the same program', async () => {
    // A different day has a different set scheme — set N's actual is not a
    // meaningful "last time" for set N of another day.
    sessions = [
      session({ id: 'other-day', dayNumber: 9, setResults: sets([12, 12, 12, 25]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 4)).toBeUndefined()
  })

  it('does not leak a higher set number from a longer same-day scheme', async () => {
    // Previous attempt had 3 sets; current scheme asks for set 5 — no data.
    sessions = [
      session({ id: 'prev', setResults: sets([8, 8, 8]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 5)).toBeUndefined()
  })

  it('respects excludeSessionId (current in-progress session)', async () => {
    sessions = [
      session({ id: 'current', setResults: sets([9, 9, 9]) }),
      session({ id: 'prev', cycleAttempt: 0, setResults: sets([7, 7, 7]) }),
    ]
    expect(await getMostRecentSetActual('pushups', 1, 1, 'current')).toBe(7)
  })
})

describe('getPreviousSetActual', () => {
  it('finds the previous attempt of the same day in the same cycle', async () => {
    sessions = [
      session({ id: 'attempt1', cycleAttempt: 1, setResults: sets([8, 8, 8, 8, 10]) }),
    ]
    // Attempt 2 of the same day — last time is the attempt-1 result.
    expect(await getPreviousSetActual('pushups', 1, 5)).toBe(10)
  })

  it('falls back to the same dayNumber from a different cycle', async () => {
    sessions = [
      session({ id: 'old-cycle', cycleId: 'pushups-0-5', dayNumber: 1, cycleAttempt: 1, setResults: sets([4, 4, 4]) }),
    ]
    expect(await getPreviousSetActual('pushups', 1, 1)).toBe(4)
  })
})

describe('getSessionComparison', () => {
  it('compares against the previous attempt of the same day in the same cycle', async () => {
    sessions = [
      session({ id: 'prev', cycleAttempt: 1, startedAt: '2026-01-01T10:00:00.000Z', setResults: sets([8, 8, 8]) }),
      session({ id: 'current', cycleAttempt: 2, startedAt: '2026-02-01T10:00:00.000Z', setResults: sets([10, 10, 10]) }),
    ]
    const { previous } = await getSessionComparison('pushups', 'current')
    expect(previous?.id).toBe('prev')
  })

  it('uses the most recent session from a previous cycle', async () => {
    // New cycle, day 1 — "last workout" is the previous cycle's last session.
    sessions = [
      session({ id: 'old-cycle-day1', cycleId: 'pushups-0-5', dayNumber: 1, setResults: sets([3, 3, 3]) }),
      session({ id: 'current', cycleId: 'pushups-6-10', dayNumber: 1, setResults: sets([8, 8, 8]) }),
    ]
    const { previous } = await getSessionComparison('pushups', 'current')
    expect(previous?.id).toBe('old-cycle-day1')
  })

  it('uses the most recent session regardless of cycle', async () => {
    // The other-cycle session is newer than the same-cycle attempt — "last
    // workout" is the newest one, not the one sharing cycleId.
    sessions = [
      session({ id: 'other-cycle-new', cycleId: 'pushups-0-5', dayNumber: 1, startedAt: '2026-01-10T10:00:00.000Z', setResults: sets([20, 20, 20]) }),
      session({ id: 'same-cycle-old', cycleAttempt: 1, dayNumber: 1, startedAt: '2026-01-05T10:00:00.000Z', setResults: sets([7, 7, 7]) }),
      session({ id: 'current', cycleAttempt: 2, dayNumber: 1, startedAt: '2026-02-01T10:00:00.000Z', setResults: sets([8, 8, 8]) }),
    ]
    const { previous } = await getSessionComparison('pushups', 'current')
    expect(previous?.id).toBe('other-cycle-new')
  })

  it('uses the most recent session even when it is a different day', async () => {
    // The user's real last workout was day 9 — it wins over an older day-1
    // session. The summary labels the source day, so this is honest.
    sessions = [
      session({ id: 'old-day1', dayNumber: 1, startedAt: '2026-01-05T10:00:00.000Z', setResults: sets([8, 8, 8]) }),
      session({ id: 'last-day9', dayNumber: 9, startedAt: '2026-02-10T10:00:00.000Z', setResults: sets([12, 12, 12, 25]) }),
      session({ id: 'current', dayNumber: 1, startedAt: '2026-02-15T10:00:00.000Z', setResults: sets([8, 8, 8]) }),
    ]
    const { previous } = await getSessionComparison('pushups', 'current')
    expect(previous?.id).toBe('last-day9')
  })

  it('returns undefined when no prior completed session exists', async () => {
    sessions = [
      session({ id: 'current', dayNumber: 1, setResults: sets([8, 8, 8]) }),
    ]
    const { previous } = await getSessionComparison('pushups', 'current')
    expect(previous).toBeUndefined()
  })
})
