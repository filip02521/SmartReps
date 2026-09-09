/**
 * Regression tests for the reliability consolidation work (Phases 1–3).
 * Each test covers a specific fix that was applied to prevent resurrection,
 * race conditions, or stale-cache failures.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Shared mocks ──
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const supabaseCallOrder: string[] = []

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
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
}))

vi.mock('@/lib/custom-sync', () => ({
  pullCustomEntities: vi.fn().mockResolvedValue(0),
  pushCustomEntities: vi.fn().mockResolvedValue(0),
}))

// ── DB mock with configurable per-test behavior ──
const mockDb = vi.hoisted(() => ({
  programProgress: {
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    toArray: vi.fn().mockResolvedValue([]),
    add: vi.fn(),
    update: vi.fn(),
  },
  workoutSessions: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  maxTests: {
    toArray: vi.fn().mockResolvedValue([]),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        filter: vi.fn(() => ({ first: vi.fn().mockResolvedValue(undefined) })),
      })),
    })),
    add: vi.fn(),
  },
  activeWorkout: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  syncQueue: {
    orderBy: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
    toArray: vi.fn().mockResolvedValue([]),
  },
  bodyWeight: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bodyWeightTombstones: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
  },
  sessionTombstones: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
  },
  aiInsights: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
  },
  customPlans: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  },
  exercises: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  customProgramProgress: {
    toArray: vi.fn().mockResolvedValue([]),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({ first: vi.fn().mockResolvedValue(undefined) })),
    })),
    delete: vi.fn(),
  },
  activeCustomWorkout: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  },
  exerciseTombstones: {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
  },
  customPlanTombstones: {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Query builder factory ──
// The builder is a thenable — awaiting it resolves to { data, error }.
// This mirrors the real Supabase JS client behavior.
function makeQueryBuilder(
  table: string,
  opts: { selectData?: unknown[]; selectError?: unknown; upsertError?: unknown } = {},
) {
  const resolveData = opts.selectData ?? []
  const resolveError = opts.selectError ?? null
  const builder: Record<string, unknown> = {
    select: vi.fn(() => {
      supabaseCallOrder.push(`select:${table}`)
      return builder
    }),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn(() => builder),
    upsert: vi.fn(async () => {
      supabaseCallOrder.push(`upsert:${table}`)
      if (opts.upsertError) return { error: opts.upsertError }
      return { error: null }
    }),
    delete: vi.fn(() => {
      supabaseCallOrder.push(`delete:${table}`)
      return builder
    }),
    in: vi.fn().mockResolvedValue({ error: null }),
    // Make the builder awaitable — resolves to { data, error }
    then: vi.fn((resolve: (v: unknown) => void) => {
      resolve({ data: resolveData, error: resolveError })
    }),
  }
  return builder
}

// ── Test setup ──
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  supabaseCallOrder.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockFrom.mockImplementation((table: string) => makeQueryBuilder(table))
  mockDb.bodyWeightTombstones.toArray.mockResolvedValue([])
  mockDb.bodyWeightTombstones.get.mockResolvedValue(undefined)
  mockDb.bodyWeight.get.mockResolvedValue(undefined)
  mockDb.bodyWeight.delete.mockResolvedValue(undefined)
  mockDb.sessionTombstones.toArray.mockResolvedValue([])
  mockDb.sessionTombstones.get.mockResolvedValue(undefined)
  mockDb.customPlanTombstones.get.mockResolvedValue(undefined)
  mockDb.customPlanTombstones.toArray.mockResolvedValue([])
  mockDb.activeCustomWorkout.toArray.mockResolvedValue([])
  mockDb.activeCustomWorkout.delete.mockResolvedValue(undefined)
  mockDb.workoutSessions.get.mockResolvedValue(undefined)
  mockDb.syncQueue.toArray.mockResolvedValue([])
  mockDb.exercises.put.mockResolvedValue(undefined)
})

// ═══════════════════════════════════════════════════════════════════
// Phase 1: Sync resurrection
// ═══════════════════════════════════════════════════════════════════

describe('Phase 1: Sync resurrection', () => {
  describe('F1.2: body-weight tombstones pulled before entries', () => {
    it('tombstone select appears before entries select', async () => {
      const { pullRemoteData } = await import('@/lib/sync')
      await pullRemoteData()
      const tombSelectIdx = supabaseCallOrder.indexOf('select:body_weight_tombstones')
      const entriesSelectIdx = supabaseCallOrder.indexOf('select:body_weight_entries')
      expect(tombSelectIdx).toBeGreaterThanOrEqual(0)
      expect(entriesSelectIdx).toBeGreaterThanOrEqual(0)
      expect(tombSelectIdx).toBeLessThan(entriesSelectIdx)
    })

    it('deleted entry is removed locally when tombstone pulled', async () => {
      const { pullRemoteData } = await import('@/lib/sync')
      mockDb.bodyWeight.get.mockResolvedValue({ id: 'bw-deleted', weightKg: 80, measuredAt: '2026-01-01' })
      mockFrom.mockImplementation((table: string) => {
        if (table === 'body_weight_tombstones') {
          return makeQueryBuilder(table, {
            selectData: [{ entry_id: 'bw-deleted', deleted_at: '2026-01-02' }],
          })
        }
        return makeQueryBuilder(table)
      })
      await pullRemoteData()
      expect(mockDb.bodyWeight.delete).toHaveBeenCalledWith('bw-deleted')
    })
  })

  describe('F1.4: push aborted when tombstone pull fails', () => {
    it('does not push when session tombstone pull fails', async () => {
      const { syncWithRemote } = await import('@/lib/sync')
      mockFrom.mockImplementation((table: string) => {
        if (table === 'session_tombstones') {
          return makeQueryBuilder(table, { selectError: { message: 'network error' } })
        }
        return makeQueryBuilder(table)
      })
      const result = await syncWithRemote()
      expect(supabaseCallOrder.some((e) => e.startsWith('upsert:'))).toBe(false)
      expect(result.ok).toBe(false)
    })

    it('pushes when non-tombstone pull fails (AI insights)', async () => {
      const { syncWithRemote } = await import('@/lib/sync')
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ai_insights') {
          return makeQueryBuilder(table, { selectError: { message: 'network error' } })
        }
        return makeQueryBuilder(table)
      })
      await syncWithRemote()
      // Push should still happen — upsert calls present
      expect(supabaseCallOrder.some((e) => e.startsWith('upsert:'))).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 2: Achievement determinism
// ═══════════════════════════════════════════════════════════════════

describe('Phase 2: Achievement determinism', () => {
  describe('F2.7: achievement mutex', () => {
    it('withAchievementLock serializes concurrent operations', async () => {
      const { withAchievementLock } = await import('@/lib/achievements/run')
      const order: string[] = []
      const slow = vi.fn(async () => {
        order.push('slow-start')
        await new Promise((r) => setTimeout(r, 50))
        order.push('slow-end')
        return 'slow'
      })
      const fast = vi.fn(async () => {
        order.push('fast')
        return 'fast'
      })
      const p1 = withAchievementLock(slow)
      const p2 = withAchievementLock(fast)
      await Promise.all([p1, p2])
      expect(order).toEqual(['slow-start', 'slow-end', 'fast'])
    })

    it('withAchievementLock does not deadlock on rejection', async () => {
      const { withAchievementLock } = await import('@/lib/achievements/run')
      const failing = vi.fn(async () => {
        throw new Error('fail')
      })
      const succeeding = vi.fn(async () => 'ok')
      await expect(withAchievementLock(failing)).rejects.toThrow('fail')
      const result = await withAchievementLock(succeeding)
      expect(result).toBe('ok')
    })
  })

  describe('F2.9: UI queue removeFromQueue', () => {
    it('removeFromQueue removes by id, not position', async () => {
      const { useAchievementUiStore } = await import('@/stores/achievement-ui-store')
      useAchievementUiStore.getState().clearQueue()
      useAchievementUiStore.getState().enqueueUnlocks(
        [
          { id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
          { id: 'habit_3_in_14', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
        ],
        false,
      )
      expect(useAchievementUiStore.getState().queue.length).toBe(2)
      useAchievementUiStore.getState().removeFromQueue('first_session')
      const queue = useAchievementUiStore.getState().queue
      expect(queue.length).toBe(1)
      expect(queue[0].id).toBe('habit_3_in_14')
    })

    it('enqueueUnlocks deduplicates by id', async () => {
      const { useAchievementUiStore } = await import('@/stores/achievement-ui-store')
      useAchievementUiStore.getState().clearQueue()
      useAchievementUiStore.getState().enqueueUnlocks(
        [{ id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null }],
        false,
      )
      useAchievementUiStore.getState().enqueueUnlocks(
        [{ id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null }],
        false,
      )
      expect(useAchievementUiStore.getState().queue.length).toBe(1)
    })

    it('enqueueUnlocks skips already-seen unlocks', async () => {
      const { useAchievementUiStore } = await import('@/stores/achievement-ui-store')
      useAchievementUiStore.getState().clearQueue()
      useAchievementUiStore.getState().enqueueUnlocks(
        [{ id: 'first_session', unlockedAt: '2026-01-01', seenAt: '2026-01-02', tierLevel: null }],
        false,
      )
      expect(useAchievementUiStore.getState().queue.length).toBe(0)
    })

    it('backfill mode sets backfillCount instead of queue', async () => {
      const { useAchievementUiStore } = await import('@/stores/achievement-ui-store')
      useAchievementUiStore.getState().clearQueue()
      useAchievementUiStore.getState().enqueueUnlocks(
        [
          { id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
          { id: 'habit_3_in_14', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
        ],
        true,
      )
      expect(useAchievementUiStore.getState().queue.length).toBe(0)
      expect(useAchievementUiStore.getState().backfillCount).toBe(2)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 3: PWA lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('Phase 3: PWA lifecycle', () => {
  describe('F3.13: chunk-recovery TTL', () => {
    it('isChunkLoadError detects dynamic import TypeError', async () => {
      const { isChunkLoadError } = await import('@/lib/chunk-load-recovery')
      expect(
        isChunkLoadError(
          new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
        ),
      ).toBe(true)
      expect(
        isChunkLoadError(
          new Error('Error loading dynamically imported module: /assets/y.js'),
        ),
      ).toBe(true)
      expect(isChunkLoadError(new Error('something else'))).toBe(false)
      expect(isChunkLoadError(new TypeError('random TypeError'))).toBe(false)
      expect(isChunkLoadError(null)).toBe(false)
      expect(isChunkLoadError(undefined)).toBe(false)
    })
  })
})
