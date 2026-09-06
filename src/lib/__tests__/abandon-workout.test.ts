import { beforeEach, describe, expect, it, vi } from 'vitest'

const workoutSessionsGet = vi.fn()
const workoutSessionsPut = vi.fn()
const workoutSessionsWhere = vi.fn()
const activeWorkoutGet = vi.fn()
const activeWorkoutPut = vi.fn()
const activeWorkoutDelete = vi.fn()
const enqueueActiveWorkoutSync = vi.fn()
const enqueueSync = vi.fn()

vi.mock('@/lib/sync', () => ({
  enqueueSync: (...args: unknown[]) => enqueueSync(...args),
  enqueueActiveWorkoutSync: (...args: unknown[]) => enqueueActiveWorkoutSync(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      get: (...args: unknown[]) => workoutSessionsGet(...args),
      put: (...args: unknown[]) => workoutSessionsPut(...args),
      where: (...args: unknown[]) => workoutSessionsWhere(...args),
    },
    activeWorkout: {
      get: (...args: unknown[]) => activeWorkoutGet(...args),
      put: (...args: unknown[]) => activeWorkoutPut(...args),
      delete: (...args: unknown[]) => activeWorkoutDelete(...args),
    },
    programProgress: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(async () => undefined),
        })),
      })),
    },
    transaction: vi.fn(
      async (_mode: string, _tables: unknown, fn: () => Promise<void>) => fn(),
    ),
  },
}))

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => ({
      hasCompletedFirstWorkout: true,
      setHasCompletedFirstWorkout: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

import { saveActiveWorkout, reconcileActiveWorkout, clearActiveWorkout } from '@/lib/program-service'
import { abandonAllInProgress, cleanupEmptyInProgressSessions } from '@/lib/session-service'

function inProgressSession(id = 's1') {
  return {
    id,
    program: 'pushups' as const,
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress' as const,
    startedAt: '2026-08-27T10:00:00.000Z',
    setResults: [],
  }
}

describe('cancel / abandon active workout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workoutSessionsWhere.mockReturnValue({
      equals: () => ({
        filter: () => ({
          toArray: async () => [],
        }),
      }),
    })
  })

  it('saveActiveWorkout refuses writes when session is abandoned', async () => {
    workoutSessionsGet.mockResolvedValue({
      ...inProgressSession(),
      status: 'abandoned',
      completedAt: '2026-08-27T10:05:00.000Z',
    })

    const ok = await saveActiveWorkout('pushups', {
      sessionId: 's1',
      currentSetIndex: 1,
      setResults: [],
      restTimerJson: null,
    })

    expect(ok).toBe(false)
    expect(activeWorkoutPut).not.toHaveBeenCalled()
    expect(enqueueActiveWorkoutSync).not.toHaveBeenCalled()
  })

  it('saveActiveWorkout writes only while session is in_progress', async () => {
    workoutSessionsGet.mockResolvedValue(inProgressSession())

    const ok = await saveActiveWorkout('pushups', {
      sessionId: 's1',
      currentSetIndex: 2,
      setResults: [{ setNumber: 1, target: { kind: 'min', reps: 5 }, actual: 5, passed: true }],
      restTimerJson: null,
    })

    expect(ok).toBe(true)
    expect(activeWorkoutPut).toHaveBeenCalledOnce()
    expect(enqueueActiveWorkoutSync).toHaveBeenCalledOnce()
  })

  it('reconcileActiveWorkout clears orphan active pointing at abandoned session', async () => {
    activeWorkoutGet.mockResolvedValue({
      program: 'pushups',
      sessionId: 's1',
      currentSetIndex: 1,
      setResults: [],
      restTimerJson: null,
      updatedAt: '2026-08-27T10:05:00.000Z',
    })
    workoutSessionsGet.mockResolvedValue({
      ...inProgressSession(),
      status: 'abandoned',
      completedAt: '2026-08-27T10:05:00.000Z',
    })

    const result = await reconcileActiveWorkout('pushups')

    expect(result).toBeUndefined()
    expect(activeWorkoutDelete).toHaveBeenCalledWith('pushups')
    expect(enqueueActiveWorkoutSync).toHaveBeenCalledWith('pushups', null)
  })

  it('abandonAllInProgress marks sessions abandoned and clears active', async () => {
    const orphans = [inProgressSession('s1'), inProgressSession('s2')]
    workoutSessionsWhere.mockReturnValue({
      equals: () => ({
        filter: () => ({
          toArray: async () => orphans,
        }),
      }),
    })

    await abandonAllInProgress('pushups')

    expect(workoutSessionsPut).toHaveBeenCalledTimes(2)
    expect(workoutSessionsPut.mock.calls.every((c) => c[0].status === 'abandoned')).toBe(true)
    expect(activeWorkoutDelete).toHaveBeenCalledWith('pushups')
    expect(enqueueActiveWorkoutSync).toHaveBeenCalledWith('pushups', null)
  })

  it('reconcileActiveWorkout clears active when session has zero completed sets', async () => {
    activeWorkoutGet.mockResolvedValue({
      program: 'pushups',
      sessionId: 's1',
      currentSetIndex: 0,
      setResults: [],
      restTimerJson: null,
      updatedAt: '2026-08-27T10:05:00.000Z',
    })
    workoutSessionsGet.mockResolvedValue(inProgressSession())
    workoutSessionsWhere.mockReturnValue({
      equals: () => ({
        filter: () => ({
          toArray: async () => [inProgressSession()],
        }),
      }),
    })

    const result = await reconcileActiveWorkout('pushups')

    expect(result).toBeUndefined()
    expect(activeWorkoutDelete).toHaveBeenCalledWith('pushups')
  })

  it('cleanupEmptyInProgressSessions abandons zero-set in_progress rows', async () => {
    workoutSessionsWhere.mockReturnValue({
      equals: () => ({
        filter: () => ({
          toArray: async () => [inProgressSession()],
        }),
      }),
    })
    activeWorkoutGet.mockResolvedValue(undefined)

    await cleanupEmptyInProgressSessions('pushups')

    expect(workoutSessionsPut).toHaveBeenCalledOnce()
    expect(workoutSessionsPut.mock.calls[0][0].status).toBe('abandoned')
  })

  it('clearActiveWorkout enqueues delete (tombstone for sync)', async () => {
    await clearActiveWorkout('pullups')
    expect(activeWorkoutDelete).toHaveBeenCalledWith('pullups')
    expect(enqueueActiveWorkoutSync).toHaveBeenCalledWith('pullups', null)
  })
})
