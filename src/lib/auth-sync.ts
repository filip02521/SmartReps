import type { NavigateFunction } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { clearAllLocalData } from '@/lib/local-data'
import { db } from '@/lib/db'
import {
  pullRemoteData,
  syncAllLocalData,
  syncWithRemote,
  type SyncResult,
} from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import { hasIncompleteSetup } from '@/lib/setup-flow'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'
import { completeOnboardingIfSynced } from '@/lib/onboarding-from-sync'

const AUTH_RETURN_KEY = 'auth-return-to'
const AUTH_FROM_ONBOARDING_KEY = 'auth-from-onboarding'

export function setAuthReturnTo(path: string | null): void {
  if (typeof sessionStorage === 'undefined') return
  if (path) sessionStorage.setItem(AUTH_RETURN_KEY, path)
}

export function setAuthFromOnboarding(fromOnboarding: boolean): void {
  if (typeof sessionStorage === 'undefined') return
  if (fromOnboarding) sessionStorage.setItem(AUTH_FROM_ONBOARDING_KEY, '1')
  else sessionStorage.removeItem(AUTH_FROM_ONBOARDING_KEY)
}

export function peekAuthFromOnboarding(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(AUTH_FROM_ONBOARDING_KEY) === '1'
}

export function consumeAuthFromOnboarding(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const value = sessionStorage.getItem(AUTH_FROM_ONBOARDING_KEY)
  if (value) sessionStorage.removeItem(AUTH_FROM_ONBOARDING_KEY)
  return value === '1'
}

export function peekAuthReturnTo(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(AUTH_RETURN_KEY)
}

export function consumeAuthReturnTo(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const value = sessionStorage.getItem(AUTH_RETURN_KEY)
  if (value) sessionStorage.removeItem(AUTH_RETURN_KEY)
  return value
}

export async function waitForStoreHydration(timeoutMs = 3000): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    window.setTimeout(() => {
      unsub()
      resolve()
    }, timeoutMs)
  })
}

export type AccountEnsureResult = 'cleared' | 'same' | 'first'

/** Prevent pushing one user's local Dexie data into another user's cloud account. */
export async function ensureAccountForSession(userId: string): Promise<AccountEnsureResult> {
  await waitForStoreHydration()
  const { lastAuthUserId } = useAppStore.getState()

  if (lastAuthUserId && lastAuthUserId !== userId) {
    await clearAllLocalData()
    useAppStore.setState({ lastAuthUserId: userId })
    showToast(pl.accountSwitchCleared, 'info')
    return 'cleared'
  }

  if (!lastAuthUserId) {
    useAppStore.setState({ lastAuthUserId: userId })
    return 'first'
  }

  return 'same'
}

/**
 * When lastAuthUserId was unknown but local Dexie already has progress, avoid blind
 * push that could upload a previous user's offline data into a cloud account that
 * already has its own history (e.g. after upgrade or logout before lastAuthUserId).
 */
async function syncForAccount(accountResult: AccountEnsureResult): Promise<SyncResult> {
  if (accountResult === 'cleared') {
    const pull = await pullRemoteData()
    const flush = await syncAllLocalData()
    return { ok: pull.ok && flush.ok, errors: pull.errors + flush.errors }
  }

  if (accountResult === 'first') {
    const hadLocalProgress = (await db.programProgress.count()) > 0
    if (hadLocalProgress && isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user.id
      if (userId) {
        const { data, error } = await supabase
          .from('program_progress')
          .select('program')
          .eq('user_id', userId)
          .limit(1)
        if (!error && data && data.length > 0) {
          const pull = await pullRemoteData()
          const flush = await syncAllLocalData()
          return { ok: pull.ok && flush.ok, errors: pull.errors + flush.errors }
        }
      }
    }
  }

  return syncWithRemote()
}

type SyncToastOpts = { showSuccessToast?: boolean; showFailureToast?: boolean }

let authenticatedSyncLock: Promise<SyncResult> | null = null
let signInFlowLock: Promise<void> | null = null
let pendingSyncToasts: SyncToastOpts = {}
let syncToastTimer: ReturnType<typeof setTimeout> | null = null
let pendingSyncToastResult: 'success' | 'failure' | null = null

/** Coalesce rapid sync result toasts — success wins over a late failure toast. */
function scheduleSyncResultToast(ok: boolean, opts: SyncToastOpts) {
  if (ok && !opts.showSuccessToast) return
  if (!ok && !opts.showFailureToast) return

  if (ok) pendingSyncToastResult = 'success'
  else if (pendingSyncToastResult !== 'success') pendingSyncToastResult = 'failure'

  if (syncToastTimer) clearTimeout(syncToastTimer)
  syncToastTimer = setTimeout(() => {
    if (pendingSyncToastResult === 'success') {
      showToast(pl.toastSyncDone, 'success')
    } else if (pendingSyncToastResult === 'failure') {
      showToast(pl.toastSyncFailed, 'error')
    }
    pendingSyncToastResult = null
    syncToastTimer = null
  }, 400)
}

export async function runAuthenticatedSync(opts?: SyncToastOpts): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { ok: true, errors: 0 }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { ok: true, errors: 0 }

  if (opts?.showSuccessToast) pendingSyncToasts.showSuccessToast = true
  if (opts?.showFailureToast) pendingSyncToasts.showFailureToast = true

  if (authenticatedSyncLock) return authenticatedSyncLock

  authenticatedSyncLock = (async () => {
    const accountResult = await ensureAccountForSession(session.user.id)
    const result = await syncForAccount(accountResult)

    const toastOpts = { ...pendingSyncToasts }
    pendingSyncToasts = {}

    scheduleSyncResultToast(result.ok, toastOpts)

    if (result.ok) {
      useAppStore.getState().setLastSyncedAt(new Date().toISOString())
      await completeOnboardingIfSynced()
      void import('@/lib/analytics').then((m) => m.track('sync_ok'))
    } else {
      void import('@/lib/analytics').then((m) => m.track('sync_failed', { errors: result.errors }))
    }

    return result
  })().finally(() => {
    authenticatedSyncLock = null
  })

  return authenticatedSyncLock
}

/** Single-flight: sync + optional post-login navigation (OTP code, Kontynuuj). */
export async function completeSignInFlow(
  navigate?: NavigateFunction,
  opts?: {
    returnTo?: string | null
    showSuccessToast?: boolean
    showFailureToast?: boolean
  },
): Promise<void> {
  if (signInFlowLock) return signInFlowLock

  signInFlowLock = (async () => {
    await waitForStoreHydration()
    await runAuthenticatedSync({
      showSuccessToast: opts?.showSuccessToast ?? false,
      showFailureToast: opts?.showFailureToast ?? false,
    })
    consumeAuthFromOnboarding()
    if (navigate) {
      try {
        await resolvePostAuthNavigation(navigate, opts?.returnTo ?? consumeAuthReturnTo())
      } catch (err) {
        console.warn('[auth] post-sign-in navigation failed', err)
      }
    }
  })().finally(() => {
    signInFlowLock = null
  })

  return signInFlowLock
}

export async function shouldNavigateAfterAuth(): Promise<boolean> {
  const { pendingStart, settings } = useAppStore.getState()
  const incomplete = await hasIncompleteSetup()
  return (
    !!pendingStart ||
    incomplete ||
    !settings.onboardingComplete ||
    window.location.pathname === '/setup/login'
  )
}

export async function handleAuthSession(
  event: 'SIGNED_IN' | 'INITIAL_SESSION',
  navigate?: NavigateFunction,
): Promise<void> {
  if (!isSupabaseConfigured) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return

  await waitForStoreHydration()

  if (event === 'SIGNED_IN') {
    const shouldNav = navigate && (await shouldNavigateAfterAuth())
    await completeSignInFlow(shouldNav ? navigate : undefined, {
      returnTo: consumeAuthReturnTo(),
      showSuccessToast: true,
      showFailureToast: true,
    })
    return
  }

  await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
}
