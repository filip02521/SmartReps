import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/lib/local-data', () => ({
  clearAllLocalData: vi.fn(),
}))

vi.mock('@/lib/sync', () => ({
  syncWithRemote: vi.fn(),
  pullRemoteData: vi.fn(),
  syncAllLocalData: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/post-auth-navigation', () => ({
  navigateAfterAuth: vi.fn(),
  resolvePostAuthNavigation: vi.fn(),
}))

vi.mock('@/lib/setup-flow', () => ({
  hasIncompleteSetup: vi.fn(),
}))

vi.mock('@/stores/toast-store', () => ({
  showToast: vi.fn(),
}))

const mockGetState = vi.fn()
const mockSetState = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: (...args: unknown[]) => mockGetState(...args),
    setState: (...args: unknown[]) => mockSetState(...args),
    persist: {
      hasHydrated: () => true,
      onFinishHydration: () => () => undefined,
    },
  }),
}))

import { supabase } from '@/lib/supabase/client'
import { clearAllLocalData } from '@/lib/local-data'
import { syncWithRemote, type SyncResult } from '@/lib/sync'
import { db } from '@/lib/db'
import { navigateAfterAuth, resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import { hasIncompleteSetup } from '@/lib/setup-flow'
import { showToast } from '@/stores/toast-store'
import {
  ensureAccountForSession,
  handleAuthSession,
  runAuthenticatedSync,
  shouldNavigateAfterAuth,
} from '@/lib/auth-sync'

describe('ensureAccountForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ lastAuthUserId: null })
  })

  it('sets lastAuthUserId on first login', async () => {
    const result = await ensureAccountForSession('user-a')
    expect(result).toBe('first')
    expect(mockSetState).toHaveBeenCalledWith({ lastAuthUserId: 'user-a' })
    expect(clearAllLocalData).not.toHaveBeenCalled()
  })

  it('returns same when user unchanged', async () => {
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    const result = await ensureAccountForSession('user-a')
    expect(result).toBe('same')
    expect(clearAllLocalData).not.toHaveBeenCalled()
  })

  it('clears local data when account switches', async () => {
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    const result = await ensureAccountForSession('user-b')
    expect(result).toBe('cleared')
    expect(clearAllLocalData).toHaveBeenCalled()
    expect(mockSetState).toHaveBeenCalledWith({ lastAuthUserId: 'user-b' })
    expect(showToast).toHaveBeenCalled()
  })
})

describe('shouldNavigateAfterAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasIncompleteSetup).mockResolvedValue(false)
  })

  it('returns true on login route', async () => {
    mockGetState.mockReturnValue({
      pendingStart: null,
      settings: { onboardingComplete: true },
    })
    const prev = window.location.pathname
    window.history.pushState({}, '', '/setup/login')
    expect(await shouldNavigateAfterAuth()).toBe(true)
    window.history.pushState({}, '', prev)
  })
})

describe('handleAuthSession', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-a',
      pendingStart: null,
      settings: { onboardingComplete: true },
    })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
    } as never)
    vi.mocked(syncWithRemote).mockResolvedValue({ ok: true, errors: 0 })
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
    vi.mocked(hasIncompleteSetup).mockResolvedValue(false)
  })

  it('syncs on INITIAL_SESSION without navigating', async () => {
    await handleAuthSession('INITIAL_SESSION', navigate)
    expect(syncWithRemote).toHaveBeenCalled()
    expect(navigateAfterAuth).not.toHaveBeenCalled()
  })

  it('syncs and navigates on SIGNED_IN when on login page', async () => {
    const prev = window.location.pathname
    window.history.pushState({}, '', '/setup/login')
    await handleAuthSession('SIGNED_IN', navigate)
    expect(syncWithRemote).toHaveBeenCalled()
    expect(resolvePostAuthNavigation).toHaveBeenCalledWith(navigate, null)
    expect(navigateAfterAuth).not.toHaveBeenCalled()
    window.history.pushState({}, '', prev)
  })
})

describe('runAuthenticatedSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
    } as never)
    vi.mocked(syncWithRemote).mockResolvedValue({ ok: true, errors: 0 })
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
  })

  it('merges toast opts when concurrent callers include SIGNED_IN', async () => {
    let resolveSync!: (v: SyncResult) => void
    vi.mocked(syncWithRemote).mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve
      }),
    )

    const p1 = runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
    const p2 = runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
    resolveSync({ ok: true, errors: 0 })
    await Promise.all([p1, p2])

    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'success')
  })
})
