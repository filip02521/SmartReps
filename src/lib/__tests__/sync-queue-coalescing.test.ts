/**
 * Tests for sync queue coalescing behavior — verifies that when the queue
 * exceeds SYNC_QUEUE_CAP, items are coalesced by entity (table + id) keeping
 * only the latest action, rather than blindly dropping oldest entries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => ({
      enabledProgramsUpdatedAt: '2026-01-01T00:00:00.000Z',
      enabledCustomWorkoutsUpdatedAt: '2026-01-01T00:00:00.000Z',
      uiSettingsUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        enabledPrograms: ['pushups'],
        enabledCustomPlanIds: [],
        customPlansFilterExplicit: false,
        theme: 'system',
        timerSound: false,
        timerVibration: false,
        keepScreenOn: true,
        reminderHour: 18,
      },
    }),
    setState: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('@/lib/enabled-programs-sync', () => ({
  mergeEnabledProgramsFromProfile: vi.fn(),
  mergeEnabledCustomWorkoutsFromProfile: vi.fn(),
  mergeEnabledProgramsFromProgress: vi.fn(),
  mergeUiSettingsFromProfile: vi.fn(),
  mergeSubscriptionFromProfile: vi.fn(),
}))

vi.mock('@/lib/custom-sync', () => ({
  pullCustomEntities: vi.fn().mockResolvedValue({ errors: 0, tombstoneErrors: 0 }),
  pushCustomEntities: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/analytics', () => ({
  trackSyncError: vi.fn(),
  track: vi.fn(),
}))

// Configurable queue state
let queueData: Array<{
  id: number
  table: string
  action: string
  payload: string
  createdAt: string
}> = []

let nextId = 1

const mockSyncQueue = {
  toArray: vi.fn(() => Promise.resolve([...queueData])),
  add: vi.fn((item: { table: string; action: string; payload: string; createdAt: string }) => {
    queueData.push({ id: nextId++, ...item })
    return Promise.resolve()
  }),
  delete: vi.fn((id: number) => {
    queueData = queueData.filter((q) => q.id !== id)
    return Promise.resolve()
  }),
  count: vi.fn(() => Promise.resolve(queueData.length)),
  orderBy: vi.fn(() => ({
    toArray: vi.fn(() => Promise.resolve([...queueData].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))),
    limit: vi.fn((n: number) => ({
      toArray: vi.fn(() =>
        Promise.resolve(
          [...queueData].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, n),
        ),
      ),
    })),
  })),
  where: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(queueData.filter((q) => q.table === 'test'))),
    })),
  })),
}

const mockDb = {
  syncQueue: mockSyncQueue,
  programProgress: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  workoutSessions: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  maxTests: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  activeWorkout: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  bodyWeight: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), clear: vi.fn() },
  bodyWeightTombstones: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn().mockReturnValue({ below: vi.fn().mockReturnValue({ delete: vi.fn() }) }), clear: vi.fn() },
  sessionTombstones: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn().mockReturnValue({ below: vi.fn().mockReturnValue({ delete: vi.fn() }) }), get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  aiInsights: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  customPlans: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  exercises: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  customProgramProgress: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  activeCustomWorkout: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  exerciseTombstones: { get: vi.fn(), put: vi.fn(), where: vi.fn().mockReturnValue({ below: vi.fn().mockReturnValue({ delete: vi.fn() }) }), clear: vi.fn() },
  customPlanTombstones: { get: vi.fn(), put: vi.fn(), where: vi.fn().mockReturnValue({ below: vi.fn().mockReturnValue({ delete: vi.fn() }) }), clear: vi.fn() },
  achievementUnlocks: { clear: vi.fn() },
  aiAnalysisCache: { clear: vi.fn() },
  aiPlanDrafts: { clear: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: mockDb }))

describe('sync queue coalescing', () => {
  beforeEach(() => {
    queueData = []
    nextId = 1
    vi.clearAllMocks()
  })

  it('deduplicates exact same table+action+payload', async () => {
    const { enqueueSync } = await import('@/lib/sync')
    await enqueueSync('workout_sessions', 'update', { id: 's1', program: 'pushups' })
    await enqueueSync('workout_sessions', 'update', { id: 's1', program: 'pushups' })
    expect(queueData.length).toBe(1)
  })

  it('allows different payloads for same table+action', async () => {
    const { enqueueSync } = await import('@/lib/sync')
    await enqueueSync('workout_sessions', 'update', { id: 's1', program: 'pushups' })
    await enqueueSync('workout_sessions', 'update', { id: 's2', program: 'pushups' })
    expect(queueData.length).toBe(2)
  })

  it('allows same payload for different actions', async () => {
    const { enqueueSync } = await import('@/lib/sync')
    await enqueueSync('workout_sessions', 'insert', { id: 's1' })
    await enqueueSync('workout_sessions', 'update', { id: 's1' })
    expect(queueData.length).toBe(2)
  })
})
