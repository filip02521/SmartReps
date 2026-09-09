/**
 * Tests for achievement sync — push, delete, pull, force-reconcile.
 * Verifies that trackSyncError is called on failures and that
 * validateForPush filters unknown IDs and clamps tiers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const trackSyncErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  trackSyncError: (...args: unknown[]) => trackSyncErrorMock(...args),
  trackSyncResult: vi.fn(),
  trackSyncSection: vi.fn(),
  trackError: vi.fn(),
  AnalyticsEvents: {
    syncSectionError: 'sync_section_error',
    syncSection: 'sync_section',
    syncResult: 'sync_result',
    achievementUnlock: 'achievement_unlock',
  },
}))

vi.mock('@/lib/achievements/store', () => ({
  getAllUnlocks: vi.fn().mockResolvedValue([]),
  mergeRemoteUnlocks: vi.fn().mockResolvedValue(undefined),
  setSuppressedAchievements: vi.fn(),
  clearSuppressedAchievements: vi.fn(),
  getSuppressedAchievements: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/achievements/snapshot', () => ({
  buildAchievementSnapshot: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/achievements/run', () => ({
  withAchievementLock: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/lib/achievements/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/achievements/catalog')>()
  return { ...actual }
})

vi.mock('@/lib/db', () => ({
  db: {
    achievementUnlocks: {
      bulkDelete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

// Helper: build a chainable query mock
function makeChain(opts: {
  selectData?: unknown[]
  selectError?: { message: string }
  upsertError?: { message: string }
  deleteError?: { message: string }
} = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: opts.selectData ?? [],
        error: opts.selectError ?? null,
      }),
    }),
    upsert: vi.fn().mockResolvedValue({
      data: null,
      error: opts.upsertError ?? null,
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: null,
          error: opts.deleteError ?? null,
        }),
      }),
    }),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
  })
})

describe('pushAchievementsToCloud', () => {
  it('tracks error when upsert fails', async () => {
    mockFrom.mockReturnValue(makeChain({ upsertError: { message: 'rls denied' } }))
    const { pushAchievementsToCloud } = await import('@/lib/achievements/sync')
    await pushAchievementsToCloud([
      { id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
    ])
    expect(trackSyncErrorMock).toHaveBeenCalledWith('achievements_push', expect.anything())
  })

  it('skips push when no valid rows', async () => {
    mockFrom.mockReturnValue(makeChain())
    const { pushAchievementsToCloud } = await import('@/lib/achievements/sync')
    await pushAchievementsToCloud([
      { id: 'unknown_id' as never, unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
    ])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('clamps tier level to catalog max', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({ upsert: upsertSpy, select: vi.fn(), delete: vi.fn() })
    const { pushAchievementsToCloud } = await import('@/lib/achievements/sync')
    // goal_pushups_100 has 3 tiers — tier 99 should be clamped to 3
    await pushAchievementsToCloud([
      { id: 'goal_pushups_100', unlockedAt: '2026-01-01', seenAt: null, tierLevel: 99 },
    ])
    const payload = upsertSpy.mock.calls[0][0]
    expect(payload[0].tier_level).toBe(3)
  })

  it('skips when supabase is not configured', async () => {
    vi.doMock('@/lib/supabase/client', () => ({
      isSupabaseConfigured: false,
      supabase: null,
    }))
    const { pushAchievementsToCloud } = await import('@/lib/achievements/sync')
    await pushAchievementsToCloud([
      { id: 'first_session', unlockedAt: '2026-01-01', seenAt: null, tierLevel: null },
    ])
    expect(trackSyncErrorMock).not.toHaveBeenCalled()
    vi.doUnmock('@/lib/supabase/client')
  })
})

describe('deleteAchievementsFromCloud', () => {
  it('tracks error when delete fails', async () => {
    mockFrom.mockReturnValue(makeChain({ deleteError: { message: 'rls denied' } }))
    const { deleteAchievementsFromCloud } = await import('@/lib/achievements/sync')
    await deleteAchievementsFromCloud(['first_session'])
    expect(trackSyncErrorMock).toHaveBeenCalledWith('achievements_delete', expect.anything())
  })

  it('skips when ids array is empty', async () => {
    mockFrom.mockReturnValue(makeChain())
    const { deleteAchievementsFromCloud } = await import('@/lib/achievements/sync')
    await deleteAchievementsFromCloud([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('pullAchievementsFromCloud', () => {
  it('does not track error on pull failure (silent return)', async () => {
    mockFrom.mockReturnValue(makeChain({ selectError: { message: 'network error' } }))
    const { pullAchievementsFromCloud } = await import('@/lib/achievements/sync')
    await pullAchievementsFromCloud()
    // pull silently returns on error — no trackSyncError for pull
    expect(trackSyncErrorMock).not.toHaveBeenCalled()
  })

  it('merges remote unlocks on successful pull', async () => {
    const { mergeRemoteUnlocks } = await import('@/lib/achievements/store')
    mockFrom.mockReturnValue(makeChain({
      selectData: [
        { achievement_id: 'first_session', unlocked_at: '2026-01-01', seen_at: null, tier_level: null },
      ],
    }))
    const { pullAchievementsFromCloud } = await import('@/lib/achievements/sync')
    await pullAchievementsFromCloud()
    expect(mergeRemoteUnlocks).toHaveBeenCalled()
  })
})

describe('forceReconcileFromCloud', () => {
  it('clears local and merges remote on force reconcile', async () => {
    const { mergeRemoteUnlocks } = await import('@/lib/achievements/store')
    const { db } = await import('@/lib/db')
    mockFrom.mockReturnValue(makeChain({
      selectData: [
        { achievement_id: 'first_session', unlocked_at: '2026-01-01', seen_at: null, tier_level: null },
      ],
    }))
    const { forceReconcileFromCloud } = await import('@/lib/achievements/sync')
    await forceReconcileFromCloud()
    expect(db.achievementUnlocks.clear).toHaveBeenCalled()
    expect(mergeRemoteUnlocks).toHaveBeenCalled()
  })

  it('sets suppressed achievements for removed local unlocks', async () => {
    const { setSuppressedAchievements, getAllUnlocks } = await import('@/lib/achievements/store')
    // Local has achievements not in remote
    vi.mocked(getAllUnlocks).mockResolvedValueOnce([
      { id: 'streak_4', unlockedAt: '2026-01-01', seenAt: null, tierLevel: 1 },
    ])
    mockFrom.mockReturnValue(makeChain({
      selectData: [
        { achievement_id: 'first_session', unlocked_at: '2026-01-01', seen_at: null, tier_level: null },
      ],
    }))
    const { forceReconcileFromCloud } = await import('@/lib/achievements/sync')
    await forceReconcileFromCloud()
    expect(setSuppressedAchievements).toHaveBeenCalledWith(['streak_4'])
  })
})
