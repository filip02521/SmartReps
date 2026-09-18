/**
 * Regression tests for workout persistence edge cases found in the
 * full workout-flow audit:
 *
 * - finalizeFailedDay on a ghost (never persisted) session must NOT regress
 *   program progress (previously it marked a never-played day as failed).
 * - finalize* on an abandoned session must not resurrect it nor touch
 *   progress (explicit user discard wins over late in-flight writes).
 * - An already-completed session advances progress using the STORED outcome,
 *   not the caller's assumption (late finalize-failed on a passed day must
 *   not regress it to cycle_failed).
 * - finalize dedupes setResults by setNumber (resume-after-crash can carry
 *   both the failed attempt and the retried result for one set).
 * - ensureWorkoutSessionPersisted must not re-write a terminal session.
 * - deleteWorkoutSession only clears the active row pointing at it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveWorkoutState, LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'

const mocks = vi.hoisted(() => {
  const sessionRows: LocalWorkoutSession[] = []
  const activeRows: ActiveWorkoutState[] = []
  return {
    sessionRows,
    activeRows,
    completeWorkoutDay: vi.fn().mockResolvedValue(undefined),
    clearActiveWorkout: vi.fn().mockResolvedValue(undefined),
    saveActiveWorkout: vi.fn().mockResolvedValue(true),
    markProgramActiveIfReady: vi.fn().mockResolvedValue(undefined),
    getActiveWorkout: vi.fn(async (program: string) =>
      activeRows.find((r) => r.program === program),
    ),
    enqueueSync: vi.fn().mockResolvedValue(undefined),
    transactionSpy: vi.fn(
      async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
    ),
  }
})
const { sessionRows, activeRows } = mocks
const {
  completeWorkoutDay,
  clearActiveWorkout,
  saveActiveWorkout,
  markProgramActiveIfReady,
  enqueueSync,
  transactionSpy,
} = mocks

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: (field: keyof LocalWorkoutSession) => ({
        equals: (value: unknown) => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () =>
              mocks.sessionRows.filter((s) => s[field] === value && fn(s)),
          }),
          toArray: async () => mocks.sessionRows.filter((s) => s[field] === value),
        }),
      }),
      get: async (id: string) => mocks.sessionRows.find((s) => s.id === id),
      put: async (row: LocalWorkoutSession) => {
        const i = mocks.sessionRows.findIndex((s) => s.id === row.id)
        if (i >= 0) mocks.sessionRows[i] = row
        else mocks.sessionRows.push(row)
      },
      delete: async (id: string) => {
        const i = mocks.sessionRows.findIndex((s) => s.id === id)
        if (i >= 0) mocks.sessionRows.splice(i, 1)
      },
    },
    activeWorkout: {
      get: async (program: string) => mocks.activeRows.find((r) => r.program === program),
      put: async (row: ActiveWorkoutState) => {
        const i = mocks.activeRows.findIndex((r) => r.program === row.program)
        if (i >= 0) mocks.activeRows[i] = row
        else mocks.activeRows.push(row)
      },
      delete: async (program: string) => {
        const i = mocks.activeRows.findIndex((r) => r.program === program)
        if (i >= 0) mocks.activeRows.splice(i, 1)
      },
    },
    activeCustomWorkout: {
      get: async (planId: string) =>
        mocks.activeRows.find((r) => (r as { customPlanId?: string }).customPlanId === planId),
    },
    sessionTombstones: { put: vi.fn().mockResolvedValue(undefined) },
    transaction: mocks.transactionSpy,
  },
}))

vi.mock('@/lib/program-service', () => ({
  completeWorkoutDay: mocks.completeWorkoutDay,
  clearActiveWorkout: mocks.clearActiveWorkout,
  saveActiveWorkout: mocks.saveActiveWorkout,
  markProgramActiveIfReady: mocks.markProgramActiveIfReady,
  getActiveWorkout: mocks.getActiveWorkout,
}))

vi.mock('@/lib/sync', () => ({ enqueueSync: mocks.enqueueSync }))
vi.mock('@/lib/auth-sync', () => ({ runAuthenticatedSync: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/achievements/schedule', () => ({ scheduleAchievementCheck: vi.fn() }))
vi.mock('@/lib/custom-session-service', () => ({
  clearActiveCustomWorkout: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvents: {
    firstWorkoutDone: 'first_workout_done',
    sessionDeleted: 'session_deleted',
  },
  trackSyncError: vi.fn(),
}))
vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ hasCompletedFirstWorkout: true })),
  }),
}))

import {
  finalizeFailedDay,
  finalizeSuccessfulDay,
  deleteWorkoutSession,
  ensureWorkoutSessionPersisted,
  getLastCompletedSession,
} from '@/lib/session-service'

function setDraft(actual: number, setNumber: number, passed = true): SetResultDraft {
  return { setNumber, target: { kind: 'fixed', reps: actual }, actual, passed }
}

function session(overrides: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 'sess-1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 3,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: '2026-01-10T10:00:00.000Z',
    setResults: [],
    ...overrides,
  }
}

beforeEach(() => {
  sessionRows.length = 0
  activeRows.length = 0
  vi.clearAllMocks()
  transactionSpy.mockImplementation(
    async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
  )
})

describe('finalizeFailedDay', () => {
  it('does NOT regress progress for a ghost session (never persisted)', async () => {
    await finalizeFailedDay('sess-ghost', 'pushups', [setDraft(5, 1, false)])
    expect(completeWorkoutDay).not.toHaveBeenCalled()
    expect(clearActiveWorkout).not.toHaveBeenCalled()
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('does not resurrect an abandoned session nor regress progress', async () => {
    sessionRows.push(session({ id: 'sess-abandoned-fail', status: 'abandoned', completedAt: '2026-01-10T10:30:00.000Z' }))
    await finalizeFailedDay('sess-abandoned-fail', 'pushups', [setDraft(5, 1, false)])
    expect(sessionRows[0]!.status).toBe('abandoned')
    expect(completeWorkoutDay).not.toHaveBeenCalled()
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('uses the STORED outcome when the session already completed as passed', async () => {
    sessionRows.push(
      session({ id: 'sess-passed-stored', status: 'completed', passed: true, totalReps: 42, completedAt: '2026-01-10T10:30:00.000Z' }),
    )
    await finalizeFailedDay('sess-passed-stored', 'pushups', [setDraft(2, 1, false)])
    // A late finalize-failed must not regress a passed day to cycle_failed.
    expect(completeWorkoutDay).toHaveBeenCalledWith('pushups', true, 42, 'sess-passed-stored', 3)
  })

  it('dedupes setResults by setNumber keeping the last entry', async () => {
    sessionRows.push(session({ id: 'sess-dedup-fail' }))
    const results = [
      setDraft(8, 1),
      setDraft(4, 2, false), // crashed-failed attempt persisted
      setDraft(9, 2),        // retried result for the same set
    ]
    await finalizeFailedDay('sess-dedup-fail', 'pushups', results)
    const saved = sessionRows[0]!
    expect(saved.status).toBe('completed')
    expect(saved.passed).toBe(false)
    expect(saved.setResults).toHaveLength(2)
    expect(saved.setResults.find((r) => r.setNumber === 2)?.actual).toBe(9)
    expect(saved.totalReps).toBe(17)
  })
})

describe('finalizeSuccessfulDay', () => {
  it('does not resurrect an abandoned session nor advance progress', async () => {
    sessionRows.push(session({ id: 'sess-abandoned-ok', status: 'abandoned', completedAt: '2026-01-10T10:30:00.000Z' }))
    await finalizeSuccessfulDay(sessionRows[0]!, [setDraft(8, 1)])
    expect(sessionRows[0]!.status).toBe('abandoned')
    expect(completeWorkoutDay).not.toHaveBeenCalled()
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('uses the STORED outcome when already completed as failed', async () => {
    sessionRows.push(
      session({ id: 'sess-failed-stored', status: 'completed', passed: false, totalReps: 20, completedAt: '2026-01-10T10:30:00.000Z' }),
    )
    await finalizeSuccessfulDay(sessionRows[0]!, [setDraft(8, 1)])
    // A late finalize-success must not flip a failed day to passed.
    expect(completeWorkoutDay).toHaveBeenCalledWith('pushups', false, 20, 'sess-failed-stored', 3)
  })

  it('completes normally, deduping results and advancing progress once', async () => {
    const s = session({ id: 'sess-normal' })
    sessionRows.push(s)
    const results = [setDraft(8, 1), setDraft(4, 2, false), setDraft(10, 2)]
    await finalizeSuccessfulDay(s, results)
    const saved = sessionRows[0]!
    expect(saved.status).toBe('completed')
    expect(saved.passed).toBe(true)
    expect(saved.setResults).toHaveLength(2)
    expect(saved.totalReps).toBe(18)
    expect(completeWorkoutDay).toHaveBeenCalledWith('pushups', true, 18, 'sess-normal', 3)
    expect(enqueueSync).toHaveBeenCalled()
  })
})

describe('ensureWorkoutSessionPersisted', () => {
  it('does not overwrite a terminal (abandoned) session or re-arm activeWorkout', async () => {
    sessionRows.push(session({ status: 'abandoned' }))
    await ensureWorkoutSessionPersisted(sessionRows[0]!, {
      currentSetIndex: 1,
      setResults: [setDraft(8, 1)],
      restTimerJson: null,
    })
    expect(sessionRows[0]!.status).toBe('abandoned')
    expect(saveActiveWorkout).not.toHaveBeenCalled()
    expect(markProgramActiveIfReady).not.toHaveBeenCalled()
  })

  it('persists a fresh session as in_progress and arms the active row', async () => {
    const s = session()
    await ensureWorkoutSessionPersisted(s, {
      currentSetIndex: 1,
      setResults: [setDraft(8, 1)],
      restTimerJson: null,
    })
    expect(sessionRows[0]!.status).toBe('in_progress')
    expect(sessionRows[0]!.setResults).toHaveLength(1)
    expect(saveActiveWorkout).toHaveBeenCalled()
  })
})

describe('deleteWorkoutSession', () => {
  it('keeps the active row when it points to a DIFFERENT session', async () => {
    sessionRows.push(session({ status: 'completed', completedAt: '2026-01-01T10:00:00.000Z' }))
    activeRows.push({
      program: 'pushups',
      sessionId: 'other-live-session',
      currentSetIndex: 2,
      setResults: [setDraft(8, 1)],
      restTimerJson: null,
      updatedAt: '2026-01-10T10:00:00.000Z',
    })
    await deleteWorkoutSession('sess-1')
    expect(clearActiveWorkout).not.toHaveBeenCalled()
  })

  it('clears the active row only when it points to the deleted session', async () => {
    sessionRows.push(session({ status: 'completed', completedAt: '2026-01-01T10:00:00.000Z' }))
    activeRows.push({
      program: 'pushups',
      sessionId: 'sess-1',
      currentSetIndex: 2,
      setResults: [setDraft(8, 1)],
      restTimerJson: null,
      updatedAt: '2026-01-10T10:00:00.000Z',
    })
    await deleteWorkoutSession('sess-1')
    expect(clearActiveWorkout).toHaveBeenCalledWith('pushups')
  })
})

describe('getLastCompletedSession', () => {
  it('orders by completion time, not start time', async () => {
    // Started earlier but finished LATER — this is the true "last workout".
    sessionRows.push(
      session({
        id: 'slow',
        status: 'completed',
        startedAt: '2026-01-10T08:00:00.000Z',
        completedAt: '2026-01-10T20:00:00.000Z',
      }),
      session({
        id: 'quick',
        status: 'completed',
        startedAt: '2026-01-10T12:00:00.000Z',
        completedAt: '2026-01-10T12:30:00.000Z',
      }),
    )
    const last = await getLastCompletedSession('pushups')
    expect(last?.id).toBe('slow')
  })
})
