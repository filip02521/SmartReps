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
  getDeadLetterCount: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      count: vi.fn(),
    },
    customPlans: {
      count: vi.fn(),
    },
    customProgramProgress: {
      count: vi.fn(),
    },
    workoutSessions: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/onboarding-from-sync', () => ({
  completeOnboardingIfSynced: vi.fn().mockResolvedValue(false),
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
  completeSignInFlow,
  ensureAccountForSession,
  handleAuthSession,
  runAuthenticatedSync,
  shouldNavigateAfterAuth,
} from '@/lib/auth-sync'
import {
  clearAccountSwitchPending,
  getAccountSwitchPending,
} from '@/lib/account-switch-gate'

describe('ensureAccountForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAccountSwitchPending()
    mockGetState.mockReturnValue({ lastAuthUserId: null })
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
    vi.mocked(db.customPlans.count).mockResolvedValue(0)
    vi.mocked(db.customProgramProgress.count).mockResolvedValue(0)
    vi.mocked(db.workoutSessions.count).mockResolvedValue(0)
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

  it('clears local data when account switches without local progress', async () => {
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
    const result = await ensureAccountForSession('user-b')
    expect(result).toBe('cleared')
    expect(clearAllLocalData).toHaveBeenCalled()
    expect(mockSetState).toHaveBeenCalledWith({ lastAuthUserId: 'user-b' })
    expect(showToast).toHaveBeenCalled()
  })

  it('returns needs_confirm when account switches with local progress', async () => {
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    vi.mocked(db.programProgress.count).mockResolvedValue(2)
    const result = await ensureAccountForSession('user-b')
    expect(result).toBe('needs_confirm')
    expect(clearAllLocalData).not.toHaveBeenCalled()
    expect(getAccountSwitchPending()?.userId).toBe('user-b')
  })
})

describe('shouldNavigateAfterAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAccountSwitchPending()
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
    clearAccountSwitchPending()
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-a',
      pendingStart: null,
      settings: { onboardingComplete: true },
      setLastSyncedAt: vi.fn(),
      setLastSyncFailureReason: vi.fn(),
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
  const setLastSyncFailureReason = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearAccountSwitchPending()
    setLastSyncFailureReason.mockReset()
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-a',
      setLastSyncedAt: vi.fn(),
      setLastSyncFailureReason,
    })
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

    await new Promise((r) => setTimeout(r, 500))
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'success')
    expect(showToast).not.toHaveBeenCalledWith(expect.any(String), 'error')
  })

  it('returns offline reason when navigator is offline', async () => {
    const prev = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    const result = await runAuthenticatedSync({ showFailureToast: true })

    expect(result).toEqual({ ok: false, errors: 0, reason: 'offline' })
    expect(setLastSyncFailureReason).toHaveBeenCalledWith('offline')

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: prev })
  })

  it('returns auth_expired when session missing but lastAuthUserId set', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never)

    const result = await runAuthenticatedSync({ showFailureToast: true })

    expect(result).toEqual({ ok: false, errors: 0, reason: 'auth_expired' })
    expect(setLastSyncFailureReason).toHaveBeenCalledWith('auth_expired')
  })

  it('shows human-readable toast for remote_error', async () => {
    vi.mocked(syncWithRemote).mockResolvedValue({ ok: false, errors: 2 })

    await runAuthenticatedSync({ showFailureToast: true })
    await new Promise((r) => setTimeout(r, 500))

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('nie powiod'),
      'error',
      undefined,
    )
  })
})

describe('completeSignInFlow', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearAccountSwitchPending()
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-a',
      pendingStart: null,
      settings: { onboardingComplete: true },
      setLastSyncedAt: vi.fn(),
      setLastSyncFailureReason: vi.fn(),
    })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
    } as never)
    vi.mocked(syncWithRemote).mockResolvedValue({ ok: true, errors: 0 })
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
  })

  it('dedupes concurrent sign-in flows', async () => {
    let resolveSync!: (v: SyncResult) => void
    vi.mocked(syncWithRemote).mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve
      }),
    )

    const p1 = completeSignInFlow(navigate, { returnTo: '/', showSuccessToast: true })
    const p2 = completeSignInFlow(navigate, { returnTo: '/', showSuccessToast: true })
    resolveSync({ ok: true, errors: 0 })
    await Promise.all([p1, p2])

    expect(syncWithRemote).toHaveBeenCalledTimes(1)
    expect(resolvePostAuthNavigation).toHaveBeenCalledTimes(1)
  })

  it('skips navigation when account switch confirmation is pending', async () => {
    mockGetState.mockReturnValue({
      lastAuthUserId: 'user-b',
      pendingStart: null,
      settings: { onboardingComplete: true },
      setLastSyncedAt: vi.fn(),
      setLastSyncFailureReason: vi.fn(),
    })
    vi.mocked(db.programProgress.count).mockResolvedValue(1)

    await completeSignInFlow(navigate, { returnTo: '/', showSuccessToast: true })

    expect(getAccountSwitchPending()?.userId).toBe('user-a')
    expect(resolvePostAuthNavigation).not.toHaveBeenCalled()
  })
})
