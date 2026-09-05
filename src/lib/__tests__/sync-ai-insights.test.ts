import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db with aiInsights store
const mockAiInsightsStore = new Map<string, any>()
vi.mock('@/lib/db', () => ({
  db: {
    aiInsights: {
      get: vi.fn(async (id: string) => mockAiInsightsStore.get(id)),
      put: vi.fn(async (item: any) => { mockAiInsightsStore.set(item.id, item) }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({
            first: vi.fn(async () => undefined),
          })),
        })),
      })),
    },
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
}))

import { mergeAiInsightRemote } from '../sync'

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
      read_at: null,
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
      read_at: null,
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
      read_at: null,
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
      read_at: null,
    }
    await mergeAiInsightRemote(remote)
    const stored = mockAiInsightsStore.get('insight-1')
    expect(stored).toBeTruthy()
    // Local should be preserved (newer)
    expect(stored.body).toBe('Zaktualizowany insight')
    expect(stored.source).toBe('ai')
  })
})
