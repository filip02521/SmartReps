/**
 * Regression tests for program progress persistence edge cases:
 *
 * - markProgramActiveIfReady must NOT wrap its update in a Dexie transaction:
 *   updateProgramProgress enqueues a sync write (syncQueue table), which is
 *   outside the programProgress transaction scope — Dexie throws
 *   NotInTransactionError and the sync item was silently lost, so the
 *   'active' status never reached the cloud.
 * - completeWorkoutDay claims its session key before any await (the old
 *   check→await→add order let concurrent calls double-advance) and releases
 *   it when the day was not actually advanced so a retry can still heal.
 * - skipRestDay must never unpause / clear a pending test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalProgramProgress } from '@/lib/db'

const mocks = vi.hoisted(() => {
  const progressRows: LocalProgramProgress[] = []
  return {
    progressRows,
    enqueueSync: vi.fn().mockResolvedValue(undefined),
    transactionSpy: vi.fn(
      async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
    ),
    updateSpy: vi.fn(async (id: number, updates: Partial<LocalProgramProgress>) => {
      const row = progressRows.find((r) => r.id === id)
      if (row) Object.assign(row, updates)
    }),
  }
})
const { progressRows, enqueueSync, transactionSpy, updateSpy } = mocks

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      where: (field: string) => ({
        equals: (value: unknown) => ({
          first: async () =>
            mocks.progressRows.find(
              (r) => r[field as keyof LocalProgramProgress] === value,
            ),
        }),
      }),
      update: mocks.updateSpy,
      add: vi.fn(),
    },
    workoutSessions: {
      where: () => ({
        equals: () => ({ toArray: async () => [] }),
      }),
    },
    activeWorkout: {
      get: vi.fn(async () => undefined),
      put: vi.fn(),
      delete: vi.fn(),
    },
    transaction: mocks.transactionSpy,
  },
}))

vi.mock('@/lib/sync', () => ({
  enqueueSync: mocks.enqueueSync,
  enqueueActiveWorkoutSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/session-service', () => ({
  cleanupEmptyInProgressSessions: vi.fn().mockResolvedValue(undefined),
}))

import {
  completeWorkoutDay,
  markProgramActiveIfReady,
  skipRestDay,
} from '@/lib/program-service'

function progress(overrides: Partial<LocalProgramProgress> = {}): LocalProgramProgress {
  return {
    id: 1,
    program: 'pushups',
    cycleId: 'pushups-11-20',
    currentDay: 1,
    status: 'rest',
    cycleAttempt: 1,
    lastWorkoutAt: '2026-01-08T10:00:00.000Z',
    nextWorkoutAfter: '2026-01-09T00:00:00.000Z', // in the past — available
    updatedAt: '2026-01-08T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  progressRows.length = 0
  vi.clearAllMocks()
})

describe('markProgramActiveIfReady', () => {
  it('activates a rested program and enqueues the sync OUTSIDE any transaction', async () => {
    progressRows.push(progress())
    await markProgramActiveIfReady('pushups')
    expect(progressRows[0]!.status).toBe('active')
    expect(enqueueSync).toHaveBeenCalledWith(
      'program_progress',
      'update',
      expect.objectContaining({ status: 'active' }),
    )
    // Regression: the update must not run inside a programProgress-scoped
    // transaction — enqueueSync touches syncQueue and would be swallowed by
    // Dexie's NotInTransactionError.
    expect(transactionSpy).not.toHaveBeenCalled()
  })

  it('does nothing while paused or test_pending', async () => {
    progressRows.push(progress({ status: 'paused', nextWorkoutAfter: null }))
    await markProgramActiveIfReady('pushups')
    expect(updateSpy).not.toHaveBeenCalled()

    progressRows[0] = progress({ status: 'test_pending' })
    await markProgramActiveIfReady('pushups')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('does nothing while rest is still scheduled', async () => {
    progressRows.push(progress({ nextWorkoutAfter: '2999-01-01T00:00:00.000Z' }))
    await markProgramActiveIfReady('pushups')
    expect(progressRows[0]!.status).toBe('rest')
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('completeWorkoutDay', () => {
  it('advances the day exactly once for repeated calls with the same session', async () => {
    progressRows.push(progress({ status: 'active' }))
    await completeWorkoutDay('pushups', true, 50, 'sess-adv-1', 1)
    await completeWorkoutDay('pushups', true, 50, 'sess-adv-1', 1)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(progressRows[0]!.currentDay).toBe(2)
  })

  it('releases the session key when progress is missing so a later retry heals', async () => {
    // No progress row — the call must not permanently consume the session key.
    await completeWorkoutDay('pushups', true, 50, 'sess-adv-2', 1)
    expect(updateSpy).not.toHaveBeenCalled()

    progressRows.push(progress({ status: 'active' }))
    await completeWorkoutDay('pushups', true, 50, 'sess-adv-2', 1)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(progressRows[0]!.currentDay).toBe(2)
  })

  it('marks cycle_failed and restarts at day 1 attempt+1 on a failed day', async () => {
    progressRows.push(progress({ status: 'active', currentDay: 3 }))
    await completeWorkoutDay('pushups', false, 30, 'sess-fail-1', 3)
    expect(progressRows[0]!.status).toBe('cycle_failed')
    expect(progressRows[0]!.currentDay).toBe(1)
    expect(progressRows[0]!.cycleAttempt).toBe(2)
  })
})

describe('skipRestDay', () => {
  it('skips rest but never unpauses or clears test_pending', async () => {
    progressRows.push(progress({ status: 'paused', nextWorkoutAfter: null }))
    await skipRestDay('pushups')
    expect(progressRows[0]!.status).toBe('paused')
    expect(updateSpy).not.toHaveBeenCalled()

    progressRows[0] = progress({ status: 'test_pending' })
    await skipRestDay('pushups')
    expect(progressRows[0]!.status).toBe('test_pending')
    expect(updateSpy).not.toHaveBeenCalled()

    progressRows[0] = progress({ status: 'rest' })
    await skipRestDay('pushups')
    expect(progressRows[0]!.status).toBe('active')
    expect(progressRows[0]!.nextWorkoutAfter).toBeNull()
  })
})
