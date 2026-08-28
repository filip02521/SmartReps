import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth-prefs', () => ({
  hasSignedOutPreference: vi.fn(() => false),
}))

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/lib/sync', () => ({
  getDeadLetterCount: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    syncQueue: {
      toArray: vi.fn(),
    },
  },
}))

const mockGetState = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: (...args: unknown[]) => mockGetState(...args),
  }),
}))

import { hasSignedOutPreference } from '@/lib/auth-prefs'
import { supabase } from '@/lib/supabase/client'
import { getDeadLetterCount } from '@/lib/sync'
import { db } from '@/lib/db'
import { getSyncStatusSnapshot, resolveAccountState } from '@/lib/sync-status'
import type { Session } from '@supabase/supabase-js'

const session = { user: { id: 'user-a', email: 'a@test.com' } } as Session

describe('resolveAccountState', () => {
  it('returns syncing when sync in progress', () => {
    expect(
      resolveAccountState({
        session,
        lastAuthUserId: 'user-a',
        signedOutPref: false,
        syncing: true,
        lastSyncFailureReason: null,
      }),
    ).toBe('syncing')
  })

  it('returns logged_in with active session and no failure', () => {
    expect(
      resolveAccountState({
        session,
        lastAuthUserId: 'user-a',
        signedOutPref: false,
        syncing: false,
        lastSyncFailureReason: null,
      }),
    ).toBe('logged_in')
  })

  it('returns sync_error when session ok but last failure set', () => {
    expect(
      resolveAccountState({
        session,
        lastAuthUserId: 'user-a',
        signedOutPref: false,
        syncing: false,
        lastSyncFailureReason: 'remote_error',
      }),
    ).toBe('sync_error')
  })

  it('returns local_only when never logged in', () => {
    expect(
      resolveAccountState({
        session: null,
        lastAuthUserId: null,
        signedOutPref: false,
        syncing: false,
        lastSyncFailureReason: null,
      }),
    ).toBe('local_only')
  })

  it('returns logged_out_locally after voluntary sign-out', () => {
    expect(
      resolveAccountState({
        session: null,
        lastAuthUserId: 'user-a',
        signedOutPref: true,
        syncing: false,
        lastSyncFailureReason: null,
      }),
    ).toBe('logged_out_locally')
  })

  it('returns session_expired when session lost unexpectedly', () => {
    expect(
      resolveAccountState({
        session: null,
        lastAuthUserId: 'user-a',
        signedOutPref: false,
        syncing: false,
        lastSyncFailureReason: null,
      }),
    ).toBe('session_expired')
  })
})

describe('getSyncStatusSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-a',
      lastSyncedAt: '2026-08-28T10:00:00.000Z',
      lastSyncFailureReason: null,
    })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
    } as never)
    vi.mocked(getDeadLetterCount).mockResolvedValue(1)
    vi.mocked(db.syncQueue.toArray).mockResolvedValue([
      { id: 1, attempts: 5, table: 'program_progress', action: 'update', payload: '{}', createdAt: '' },
      { id: 2, attempts: 0, table: 'program_progress', action: 'update', payload: '{}', createdAt: '' },
    ])
    vi.mocked(hasSignedOutPreference).mockReturnValue(false)
  })

  it('aggregates queue pending excluding dead letter items', async () => {
    const snap = await getSyncStatusSnapshot({ syncing: false, online: true })
    expect(snap.deadLetterCount).toBe(1)
    expect(snap.queuePendingCount).toBe(1)
    expect(snap.accountState).toBe('logged_in')
    expect(snap.email).toBe('a@test.com')
    expect(snap.lastSyncedAt).toBe('2026-08-28T10:00:00.000Z')
  })

  it('reflects syncing override', async () => {
    const snap = await getSyncStatusSnapshot({ syncing: true, online: true })
    expect(snap.accountState).toBe('syncing')
  })

  it('maps signed-out preference to logged_out_locally', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never)
    vi.mocked(hasSignedOutPreference).mockReturnValue(true)

    const snap = await getSyncStatusSnapshot({ syncing: false, online: true })
    expect(snap.accountState).toBe('logged_out_locally')
    expect(snap.email).toBeNull()
  })
})
