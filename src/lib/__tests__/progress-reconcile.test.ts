/**
 * Regression tests for reconcileProgressFromSessions — the self-heal that
 * re-advances program_progress when a completed session's progress update was
 * lost (app closed between the session write and the progress write).
 *
 * Production incident: pushups-11-20 day 6 session synced as completed/passed
 * while program_progress stayed on day 6 — the card never advanced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'

const progressRows: LocalProgramProgress[] = []
const sessionRows: LocalWorkoutSession[] = []

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      where: (field: string) => ({
        equals: (value: unknown) => ({
          first: async () =>
            progressRows.find(
              (r) => r[field as keyof LocalProgramProgress] === value,
            ),
        }),
      }),
      update: async (id: number, updates: Partial<LocalProgramProgress>) => {
        const row = progressRows.find((r) => r.id === id)
        if (row) Object.assign(row, updates)
      },
    },
    workoutSessions: {
      where: (field: string) => ({
        equals: (value: unknown) => ({
          toArray: async () =>
            field === '[program+status]'
              ? sessionRows.filter(
                  (s) =>
                    s.program === (value as [string, string])[0] &&
                    s.status === (value as [string, string])[1],
                )
              : sessionRows.filter(
                  (s) => s[field as keyof LocalWorkoutSession] === value,
                ),
        }),
      }),
    },
    transaction: async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
  },
}))

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn().mockResolvedValue(undefined),
  enqueueActiveWorkoutSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/session-service', () => ({
  cleanupEmptyInProgressSessions: vi.fn().mockResolvedValue(undefined),
}))

import { reconcileProgressFromSessions } from '@/lib/program-service'

function progress(overrides: Partial<LocalProgramProgress> = {}): LocalProgramProgress {
  return {
    id: 1,
    program: 'pushups',
    cycleId: 'pushups-11-20',
    currentDay: 6,
    status: 'rest',
    cycleAttempt: 1,
    lastWorkoutAt: '2026-09-09T17:50:37.737Z',
    nextWorkoutAfter: '2026-09-10T22:00:00.000Z',
    updatedAt: '2026-09-09T17:50:37.737Z',
    ...overrides,
  }
}

function session(overrides: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: crypto.randomUUID(),
    program: 'pushups',
    cycleId: 'pushups-11-20',
    dayNumber: 6,
    cycleAttempt: 1,
    status: 'completed',
    passed: true,
    startedAt: '2026-09-13T13:11:02.934Z',
    completedAt: '2026-09-13T13:22:43.733Z',
    totalReps: 75,
    setResults: [],
    ...overrides,
  }
}

beforeEach(() => {
  progressRows.length = 0
  sessionRows.length = 0
})

describe('reconcileProgressFromSessions', () => {
  it('advances to the next cycle when the final day was completed but progress was never updated', async () => {
    progressRows.push(progress())
    sessionRows.push(session())

    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0]).toMatchObject({
      cycleId: 'pushups-21-25',
      currentDay: 1,
      status: 'rest',
      cycleAttempt: 1,
    })
    expect(progressRows[0].lastWorkoutAt).not.toBe('2026-09-09T17:50:37.737Z')
    expect(progressRows[0].nextWorkoutAfter).not.toBeNull()
  })

  it('is idempotent — a second run changes nothing', async () => {
    progressRows.push(progress())
    sessionRows.push(session())

    await reconcileProgressFromSessions('pushups')
    const after = { ...progressRows[0] }
    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0]).toEqual(after)
  })

  it('advances a mid-cycle day when its passed session was not consumed', async () => {
    progressRows.push(progress({ currentDay: 3 }))
    sessionRows.push(session({ dayNumber: 3 }))

    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0]).toMatchObject({
      cycleId: 'pushups-11-20',
      currentDay: 4,
      status: 'rest',
      cycleAttempt: 1,
    })
  })

  it('does nothing when the session was already consumed by progress', async () => {
    progressRows.push(
      progress({ lastWorkoutAt: '2026-09-13T13:22:44.000Z' }),
    )
    sessionRows.push(session())

    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0].cycleId).toBe('pushups-11-20')
    expect(progressRows[0].currentDay).toBe(6)
  })

  it('replays an unconsumed failed day as cycle_failed with attempt + 1', async () => {
    progressRows.push(progress({ currentDay: 3 }))
    sessionRows.push(session({ dayNumber: 3, passed: false }))

    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0]).toMatchObject({
      status: 'cycle_failed',
      currentDay: 1,
      cycleAttempt: 2,
      cycleId: 'pushups-11-20',
    })
  })

  it('ignores sessions from a different cycle or attempt', async () => {
    progressRows.push(progress())
    sessionRows.push(
      session({ cycleId: 'pushups-6-10' }),
      session({ cycleAttempt: 2 }),
    )

    await reconcileProgressFromSessions('pushups')

    expect(progressRows[0].currentDay).toBe(6)
    expect(progressRows[0].cycleId).toBe('pushups-11-20')
  })

  it('does nothing while paused or awaiting a test', async () => {
    progressRows.push(progress({ status: 'paused' }))
    progressRows.push(
      progress({ id: 2, program: 'pullups', status: 'test_pending' }),
    )
    sessionRows.push(session())
    sessionRows.push(
      session({ program: 'pullups', cycleId: 'pullups-9-11' }),
    )

    await reconcileProgressFromSessions('pushups')
    await reconcileProgressFromSessions('pullups')

    expect(progressRows[0].status).toBe('paused')
    expect(progressRows[1].status).toBe('test_pending')
  })

  it('does nothing without a progress row', async () => {
    sessionRows.push(session())
    await reconcileProgressFromSessions('pushups')
    expect(progressRows).toHaveLength(0)
  })
})
