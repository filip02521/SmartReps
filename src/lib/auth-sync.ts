import type { NavigateFunction } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { clearAllLocalData } from '@/lib/local-data'
import { db } from '@/lib/db'
import {
  pullRemoteData,
  syncAllLocalData,
  syncWithRemote,
  getDeadLetterCount,
  type SyncFailureReason,
  type SyncResult,
} from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import { hasIncompleteSetup } from '@/lib/setup-flow'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'
import { completeOnboardingIfSynced } from '@/lib/onboarding-from-sync'
import { track } from '@/lib/analytics'
import { clearSignedOutPreference } from '@/lib/auth-lifecycle'

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

export type AccountEnsureResult = 'cleared' | 'same' | 'first' | 'needs_confirm'

/** Prevent pushing one user's local Dexie data into another user's cloud account. */
async function hasLocalTrainingData(): Promise<boolean> {
  const [progressCount, customPlans, customProgress, sessions] = await Promise.all([
    db.programProgress.count(),
    db.customPlans.count(),
    db.customProgramProgress.count(),
    db.workoutSessions.count(),
  ])
  return progressCount + customPlans + customProgress + sessions > 0
}

export async function ensureAccountForSession(userId: string): Promise<AccountEnsureResult> {
  await waitForStoreHydration()
  const { lastAuthUserId } = useAppStore.getState()

  if (lastAuthUserId && lastAuthUserId !== userId) {
    if (await hasLocalTrainingData()) {
      const { setAccountSwitchPending } = await import('@/lib/account-switch-gate')
      setAccountSwitchPending({ userId })
      track('account_switch_prompt_shown')
      return 'needs_confirm'
    }
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
    const hadLocalData = await hasLocalTrainingData()
    if (hadLocalData && isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user.id
      if (userId) {
        const [{ data: prog, error: progErr }, { data: custom, error: customErr }] =
          await Promise.all([
            supabase.from('program_progress').select('program').eq('user_id', userId).limit(1),
            supabase.from('custom_plans').select('id').eq('user_id', userId).limit(1),
          ])
        if (!progErr && !customErr && ((prog?.length ?? 0) > 0 || (custom?.length ?? 0) > 0)) {
          const pull = await pullRemoteData()
          const flush = await syncAllLocalData()
          return { ok: pull.ok && flush.ok, errors: pull.errors + flush.errors }
        }
      }
    }
  }

  return syncWithRemote()
}

type SyncToastOpts = {
  showSuccessToast?: boolean
  showFailureToast?: boolean
  /** Skip offline failure toast (boot sync while offline). */
  silentOffline?: boolean
}

let authenticatedSyncLock: Promise<SyncResult> | null = null

/** Check if an authenticated sync is currently running. Used by clearAllLocalData
 *  to avoid racing with an active sync (which could write data back to a cleared DB). */
export function isSyncRunning(): boolean {
  return authenticatedSyncLock !== null
}

/** Wait for any in-progress sync to complete before proceeding. */
export async function waitForSyncToFinish(timeoutMs = 10_000): Promise<void> {
  if (!authenticatedSyncLock) return
  try {
    await Promise.race([
      authenticatedSyncLock,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('sync timeout')), timeoutMs)),
    ])
  } catch {
    // Sync failed or timed out — proceed anyway
  }
}
let signInFlowLock: Promise<void> | null = null
let pendingSyncToasts: SyncToastOpts = {}
let syncToastTimer: ReturnType<typeof setTimeout> | null = null
let pendingSyncToastResult: { ok: boolean; reason?: SyncFailureReason } | null = null

function loginToastAction() {
  const returnTo =
    typeof window !== 'undefined' && !window.location.pathname.startsWith('/setup/')
      ? window.location.pathname + window.location.search
      : '/'
  return {
    label: pl.sessionLostReLoginAction,
    onClick: () => {
      try {
        sessionStorage.setItem(AUTH_RETURN_KEY, returnTo)
      } catch {
        // ignore
      }
      window.location.assign(`/setup/login?returnTo=${encodeURIComponent(returnTo)}`)
    },
  }
}

function failureToastForReason(reason: SyncFailureReason): {
  message: string
  variant: 'info' | 'warning' | 'error'
  action?: { label: string; onClick: () => void }
} {
  switch (reason) {
    case 'offline':
      return { message: pl.toastSyncFailedOffline, variant: 'info' }
    case 'auth_expired':
      return {
        message: pl.toastSyncFailedSession,
        variant: 'info',
        action: loginToastAction(),
      }
    case 'dead_letter':
      return { message: pl.toastSyncFailedDeadLetter, variant: 'warning' }
    case 'remote_error':
      return { message: pl.toastSyncFailedRemote, variant: 'error' }
    case 'no_session':
      return { message: pl.toastSyncFailed, variant: 'info' }
    default:
      return { message: pl.toastSyncFailed, variant: 'error' }
  }
}

async function inferFailureReason(errors: number): Promise<SyncFailureReason> {
  if ((await getDeadLetterCount()) > 0) return 'dead_letter'
  if (errors > 0) return 'remote_error'
  return 'unknown'
}

/** Coalesce rapid sync result toasts — success wins over a late failure toast. */
function scheduleSyncResultToast(
  ok: boolean,
  opts: SyncToastOpts,
  reason?: SyncFailureReason,
) {
  if (ok && !opts.showSuccessToast) return
  if (!ok && !opts.showFailureToast) return
  if (!ok && reason === 'offline' && opts.silentOffline) return
  if (!ok && reason === 'no_session') return

  if (ok) pendingSyncToastResult = { ok: true }
  else if (!pendingSyncToastResult?.ok) pendingSyncToastResult = { ok: false, reason }

  if (syncToastTimer) clearTimeout(syncToastTimer)
  syncToastTimer = setTimeout(() => {
    if (pendingSyncToastResult?.ok) {
      showToast(pl.toastSyncDone, 'success')
    } else if (pendingSyncToastResult && !pendingSyncToastResult.ok) {
      const toast = failureToastForReason(pendingSyncToastResult.reason ?? 'unknown')
      showToast(toast.message, toast.variant, toast.action ? { action: toast.action } : undefined)
    }
    pendingSyncToastResult = null
    syncToastTimer = null
  }, 400)
}

export async function runAuthenticatedSync(opts?: SyncToastOpts): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { ok: true, errors: 0 }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const reason: SyncFailureReason = 'offline'
    useAppStore.getState().setLastSyncFailureReason(reason)
    scheduleSyncResultToast(false, opts ?? {}, reason)
    return { ok: false, errors: 0, reason }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    const { lastAuthUserId } = useAppStore.getState()
    if (lastAuthUserId) {
      const reason: SyncFailureReason = 'auth_expired'
      useAppStore.getState().setLastSyncFailureReason(reason)
      scheduleSyncResultToast(false, opts ?? {}, reason)
      return { ok: false, errors: 0, reason }
    }
    return { ok: true, errors: 0, reason: 'no_session' }
  }

  if (opts?.showSuccessToast) pendingSyncToasts.showSuccessToast = true
  if (opts?.showFailureToast) pendingSyncToasts.showFailureToast = true
  if (opts?.silentOffline) pendingSyncToasts.silentOffline = true

  if (authenticatedSyncLock) return authenticatedSyncLock

  // Timeout guard: if sync hangs (slow network, unresponsive server), release
  // the lock after 90s so future sync attempts aren't blocked forever.
  const SYNC_TIMEOUT_MS = 90_000

  authenticatedSyncLock = (async () => {
    const accountResult = await ensureAccountForSession(session.user.id)
    if (accountResult === 'needs_confirm') {
      return { ok: false, errors: 0, reason: 'unknown' as SyncFailureReason }
    }
    const result = await syncForAccount(accountResult)

    let reason = result.reason
    if (!result.ok && !reason) {
      reason = await inferFailureReason(result.errors)
    }

    const finalResult: SyncResult = reason ? { ...result, reason } : result

    const toastOpts = { ...pendingSyncToasts }
    pendingSyncToasts = {}

    scheduleSyncResultToast(finalResult.ok, toastOpts, reason)

    if (finalResult.ok) {
      useAppStore.getState().setLastSyncedAt(new Date().toISOString())
      useAppStore.getState().setLastSyncFailureReason(null)
      await completeOnboardingIfSynced()
      track('sync_ok')
      try {
        const { pullAchievementsFromCloud } = await import('@/lib/achievements/sync')
        const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
        await pullAchievementsFromCloud()
        // Queue unseen remote unlocks (earned on another device, not yet shown here)
        const { listUnseenUnlocks } = await import('@/lib/achievements/store')
        const { useAchievementUiStore } = await import('@/stores/achievement-ui-store')
        const unseen = await listUnseenUnlocks()
        if (unseen.length > 0) {
          useAchievementUiStore.getState().enqueueUnlocks(unseen, false)
        }
        scheduleAchievementCheck()
      } catch {
        /* best-effort */
      }
    } else {
      if (reason) useAppStore.getState().setLastSyncFailureReason(reason)
      track('sync_failed', { errors: finalResult.errors, reason: reason ?? 'unknown' })
    }

    return finalResult
  })()

  // Race the sync against a timeout. If the timeout wins, return a failure
  // result but still clear the lock so the next sync can proceed.
  const timeoutPromise = new Promise<SyncResult>((resolve) => {
    setTimeout(() => {
      resolve({ ok: false, errors: 0, reason: 'network' as SyncFailureReason })
    }, SYNC_TIMEOUT_MS)
  })

  return Promise.race([authenticatedSyncLock, timeoutPromise]).finally(() => {
    authenticatedSyncLock = null
  })
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
    clearSignedOutPreference()
    await runAuthenticatedSync({
      showSuccessToast: opts?.showSuccessToast ?? false,
      showFailureToast: opts?.showFailureToast ?? false,
    })

    const { getAccountSwitchPending } = await import('@/lib/account-switch-gate')
    if (getAccountSwitchPending()) {
      return
    }

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
