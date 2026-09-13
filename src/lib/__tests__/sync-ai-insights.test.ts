import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db with aiInsights + aiInsightTombstones stores
const mockAiInsightsStore = new Map<string, any>()
const mockTombstoneStore = new Map<string, any>()
const mockSyncQueue: any[] = []
vi.mock('@/lib/db', () => ({
  db: {
    aiInsights: {
      get: vi.fn(async (id: string) => mockAiInsightsStore.get(id)),
      put: vi.fn(async (item: any) => { mockAiInsightsStore.set(item.id, item) }),
      delete: vi.fn(async (id: string) => { mockAiInsightsStore.delete(id) }),
      where: vi.fn(() => ({
        equals: vi.fn((value: unknown) => ({
          filter: vi.fn((pred: (i: any) => boolean) => ({
            first: vi.fn(async () => undefined),
            toArray: vi.fn(async () =>
              [...mockAiInsightsStore.values()].filter(
                (i) => i.weekKey === value && pred(i),
              ),
            ),
          })),
        })),
      })),
    },
    aiInsightTombstones: {
      get: vi.fn(async (id: string) => mockTombstoneStore.get(id)),
      put: vi.fn(async (t: any) => { mockTombstoneStore.set(t.insightId, t) }),
    },
    syncQueue: {
      toArray: vi.fn(async () => [...mockSyncQueue]),
      add: vi.fn(async (item: any) => { mockSyncQueue.push(item); return item }),
      count: vi.fn(async () => mockSyncQueue.length),
      orderBy: vi.fn(() => ({ toArray: vi.fn(async () => [...mockSyncQueue]) })),
    },
    transaction: vi.fn(async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn()),
  },
}))

// Mock supabase client
const mockSupabaseFrom = vi.fn()
vi.mock('@/lib/supabase-client', () => ({
  getSupabase: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  getUserId: vi.fn(async () => 'user-123'),
}))

// Mock sync-queue-utils
vi.mock('@/lib/sync-queue-utils', () => ({
  hasPendingSyncQueue: vi.fn(async () => false),
  hasPendingInsightDelete: vi.fn(async () => false),
}))

import { deleteAiInsight, mergeAiInsightRemote } from '../sync'

describe('mergeAiInsightRemote — LWW with dismiss', () => {
  beforeEach(() => {
    mockAiInsightsStore.clear()
    vi.clearAllMocks()
  })

  it('creates new insight from remote when not existing locally', async () => {
    const remote = {
      id: 'insight-1',
      type: 'post_workout' as const,
      session_id: 'session-1',
      week_key: null,
      program: 'pushups',
      custom_plan_id: null,
      title: 'Trener',
      body: 'Dobra sesja!',
      tone: 'insight' as const,
      source: 'local' as const,
      created_at: '2025-01-01T10:00:00Z',
      dismissed_at: null,
      read_at: null, metrics_json: null,
    }
    await mergeAiInsightRemote(remote)
    const stored = mockAiInsightsStore.get('insight-1')
    expect(stored).toBeTruthy()
    expect(stored.id).toBe('insight-1')
    expect(stored.sessionId).toBe('session-1')
    expect(stored.dismissedAt).toBeUndefined()
  })

  it('applies remote dismiss when local is not dismissed', async () => {
    // Local insight exists, not dismissed
    mockAiInsightsStore.set('insight-1', {
      id: 'insight-1',
      type: 'post_workout',
      sessionId: 'session-1',
      title: 'Trener',
      body: 'Dobra sesja!',
      tone: 'insight',
      source: 'local',
      createdAt: '2025-01-01T10:00:00Z',
    })

    // Remote has same insight but dismissed
    const remote = {
      id: 'insight-1',
      type: 'post_workout' as const,
      session_id: 'session-1',
      week_key: null,
      program: 'pushups',
      custom_plan_id: null,
      title: 'Trener',
      body: 'Dobra sesja!',
      tone: 'insight' as const,
      source: 'local' as const,
      created_at: '2025-01-01T10:00:00Z',
      dismissed_at: '2025-01-02T12:00:00Z',
      read_at: null, metrics_json: null,
    }
    await mergeAiInsightRemote(remote)
    const stored = mockAiInsightsStore.get('insight-1')
    expect(stored).toBeTruthy()
    expect(stored.dismissedAt).toBe('2025-01-02T12:00:00Z')
  })

  it('preserves local dismiss when remote is not dismissed', async () => {
    // Local insight exists, dismissed
    mockAiInsightsStore.set('insight-1', {
      id: 'insight-1',
      type: 'post_workout',
      sessionId: 'session-1',
      title: 'Trener',
      body: 'Dobra sesja!',
      tone: 'insight',
      source: 'local',
      createdAt: '2025-01-01T10:00:00Z',
      dismissedAt: '2025-01-02T12:00:00Z',
    })

    // Remote has same insight, not dismissed, same createdAt
    const remote = {
      id: 'insight-1',
      type: 'post_workout' as const,
      session_id: 'session-1',
      week_key: null,
      program: 'pushups',
      custom_plan_id: null,
      title: 'Trener',
      body: 'Dobra sesja!',
      tone: 'insight' as const,
      source: 'local' as const,
      created_at: '2025-01-01T10:00:00Z',
      dismissed_at: null,
      read_at: null, metrics_json: null,
    }
    await mergeAiInsightRemote(remote)
    const stored = mockAiInsightsStore.get('insight-1')
    expect(stored).toBeTruthy()
    // Local dismiss should be preserved (remote doesn't have dismiss, same createdAt)
    expect(stored.dismissedAt).toBe('2025-01-02T12:00:00Z')
  })

  it('does not overwrite when remote is older and no state changes', async () => {
    // Local insight is newer
    mockAiInsightsStore.set('insight-1', {
      id: 'insight-1',
      type: 'post_workout',
      sessionId: 'session-1',
      title: 'Trener',
      body: 'Zaktualizowany insight',
      tone: 'success',
      source: 'ai',
      createdAt: '2025-01-05T10:00:00Z',
    })

    // Remote is older
    const remote = {
      id: 'insight-1',
      type: 'post_workout' as const,
      session_id: 'session-1',
      week_key: null,
      program: 'pushups',
      custom_plan_id: null,
      title: 'Trener',
      body: 'Stary insight',
      tone: 'insight' as const,
      source: 'local' as const,
      created_at: '2025-01-01T10:00:00Z',
      dismissed_at: null,
      read_at: null, metrics_json: null,
    }
    await mergeAiInsightRemote(remote)
    const stored = mockAiInsightsStore.get('insight-1')
    expect(stored).toBeTruthy()
    // Local should be preserved (newer)
    expect(stored.body).toBe('Zaktualizowany insight')
    expect(stored.source).toBe('ai')
  })
})

describe('ai_insights tombstones — no cross-device resurrection', () => {
  beforeEach(() => {
    mockAiInsightsStore.clear()
    mockTombstoneStore.clear()
    mockSyncQueue.length = 0
    vi.clearAllMocks()
  })

  const baseRemote = (over: Record<string, unknown> = {}) => ({
    id: 'insight-dead',
    type: 'post_workout' as const,
    session_id: 's-1',
    week_key: null,
    program: 'pushups',
    custom_plan_id: null,
    title: 'Trener',
    body: 'Insight',
    tone: 'insight' as const,
    source: 'local' as const,
    created_at: '2025-01-01T10:00:00Z',
    dismissed_at: null,
    read_at: null,
    metrics_json: null,
    ...over,
  })

  it('mergeAiInsightRemote skips a remote row when a tombstone exists', async () => {
    mockTombstoneStore.set('insight-dead', {
      insightId: 'insight-dead',
      deletedAt: '2025-01-02T00:00:00Z',
    })
    await mergeAiInsightRemote(baseRemote())
    expect(mockAiInsightsStore.get('insight-dead')).toBeUndefined()
  })

  it('deleteAiInsight writes tombstone, deletes local row and enqueues cloud delete', async () => {
    mockAiInsightsStore.set('insight-dead', {
      id: 'insight-dead',
      type: 'post_workout',
      title: 'T',
      body: 'B',
      tone: 'insight',
      source: 'local',
      createdAt: '2025-01-01T10:00:00Z',
    })
    await deleteAiInsight({ id: 'insight-dead' })
    expect(mockTombstoneStore.get('insight-dead')).toBeTruthy()
    expect(mockAiInsightsStore.get('insight-dead')).toBeUndefined()
    const queued = mockSyncQueue.find(
      (q) => q.table === 'ai_insights' && q.action === 'delete',
    )
    expect(queued).toBeTruthy()
    expect(JSON.parse(queued.payload).id).toBe('insight-dead')
  })

  it('weekly_report merge replaces same-week local reports with tombstoned deletes', async () => {
    mockAiInsightsStore.set('local-report', {
      id: 'local-report',
      type: 'weekly_report',
      weekKey: '2025-W01',
      title: 'Raport',
      body: 'Lokalny',
      tone: 'insight',
      source: 'local',
      createdAt: '2025-01-01T08:00:00Z',
    })
    await mergeAiInsightRemote(
      baseRemote({
        id: 'ai-report',
        type: 'weekly_report',
        week_key: '2025-W01',
        source: 'ai',
      }),
    )
    // Local report deleted + tombstoned; AI report stored
    expect(mockAiInsightsStore.get('local-report')).toBeUndefined()
    expect(mockTombstoneStore.get('local-report')).toBeTruthy()
    expect(mockAiInsightsStore.get('ai-report')).toBeTruthy()
  })
})
