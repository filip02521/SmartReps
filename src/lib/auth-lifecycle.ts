import type { NavigateFunction } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { wipeDurableAuthStorage } from '@/lib/auth-storage'
import {
  clearSignedOutPreferenceKeys,
  hasSignedOutPreference,
  setIntentionalSignOutFlag,
  setSignedOutPreference,
  takeIntentionalSignOutFlag,
} from '@/lib/auth-prefs'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { trackSessionLostUnexpected } from '@/lib/analytics'
import { pl } from '@/i18n/pl'
import { unsubscribeWebPush } from '@/lib/web-push'
import {
  isSessionExpiredToastInCooldown,
  markSessionExpiredToastShown,
  resetSessionExpiredToastCooldown,
} from '@/lib/notification-cooldown'

/** Must match auth-sync AUTH_RETURN_KEY — avoid importing auth-sync (cycle). */
const AUTH_RETURN_KEY = 'auth-return-to'

let lifecycleStarted = false

async function waitForStoreHydration(timeoutMs = 3000): Promise<void> {
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

/** Call immediately before user-initiated signOut so we don't show "session lost". */
export function markIntentionalSignOut(): void {
  setIntentionalSignOutFlag()
  setSignedOutPreference()
}

/** After a successful login, allow future unexpected-loss toasts again. */
export function clearSignedOutPreference(): void {
  clearSignedOutPreferenceKeys()
  resetSessionExpiredToastCooldown()
}

export function consumeIntentionalSignOut(): boolean {
  return takeIntentionalSignOutFlag()
}

export async function signOutUser(
  options?: Parameters<typeof supabase.auth.signOut>[0],
): Promise<void> {
  if (!isSupabaseConfigured) return
  markIntentionalSignOut()
  if (useAppStore.getState().settings.pushNotifications) {
    await unsubscribeWebPush()
  }
  // Cancel any pending local reminder — without this, the setTimeout reminder
  // can still fire for the previous account after logout.
  try {
    const { cancelReminder } = await import('@/lib/notifications')
    cancelReminder()
  } catch {
    // best-effort
  }
  const { error } = await supabase.auth.signOut(options)
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    // Local session still present — don't suppress future unexpected-loss toasts.
    clearSignedOutPreference()
    if (error) throw error
    return
  }
  // Belt-and-suspenders: clear durable mirror even if GoTrue removeItem raced.
  await wipeDurableAuthStorage()
  // NOTE: Local workout data is NOT cleared here. The UI offers two options:
  // - "Wyloguj — zostaw dane" (logoutOnly) — keeps data for offline re-login
  // - "Wyloguj" (logoutAndClear) — calls clearAllLocalData() explicitly
  // Adding clearAllLocalData() here would remove the user's choice.
}

function isOnLoginRoute(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/setup/login')
}

/** Toast once when cloud session disappeared but local progress account is remembered. */
export async function notifyUnexpectedSessionLoss(
  navigate?: NavigateFunction,
): Promise<void> {
  await waitForStoreHydration()
  if (!useAppStore.getState().lastAuthUserId) return
  if (hasSignedOutPreference()) {
    consumeIntentionalSignOut()
    return
  }
  if (consumeIntentionalSignOut()) return
  if (isOnLoginRoute()) return

  // Track analytics BEFORE cooldown check — the event tracks the session loss
  // itself, not the toast. If scheduleSyncResultToast (auth_expired) already
  // set the cooldown, we still want to record that the SIGNED_OUT event fired.
  trackSessionLostUnexpected()

  // Shared cooldown — prevents repeated session-expired toasts when multiple
  // sync triggers fire (online, visibility, boot, manual, post-workout).
  // Both notifyUnexpectedSessionLoss (SIGNED_OUT) and scheduleSyncResultToast
  // (auth_expired) use this same cooldown, so the user sees ONE notification.
  if (isSessionExpiredToastInCooldown()) return
  markSessionExpiredToastShown()

  const returnTo =
    typeof window !== 'undefined' && !window.location.pathname.startsWith('/setup/')
      ? window.location.pathname + window.location.search
      : '/'

  showToast(pl.sessionLostReLogin, 'warning', {
    durationMs: 12000,
    action: {
      label: pl.sessionLostReLoginAction,
      onClick: () => {
        try {
          sessionStorage.setItem(AUTH_RETURN_KEY, returnTo)
        } catch {
          // ignore
        }
        if (navigate) {
          navigate('/setup/login', { state: { returnTo } })
        } else {
          window.location.assign(
            `/setup/login?returnTo=${encodeURIComponent(returnTo)}`,
          )
        }
      },
    },
  })
}

/**
 * Recover session after iOS bfcache / PWA resume.
 * Online recovery is owned by setupOnlineSync → runAuthenticatedSync (avoids double getSession).
 * Do not call startAutoRefresh — GoTrue already ties refresh to visibility.
 */
export function setupAuthLifecycle(): () => void {
  if (!isSupabaseConfigured || typeof window === 'undefined' || lifecycleStarted) {
    return () => {}
  }
  lifecycleStarted = true

  let recoverTimer: ReturnType<typeof setTimeout> | null = null
  const recover = () => {
    if (recoverTimer) clearTimeout(recoverTimer)
    recoverTimer = setTimeout(() => {
      recoverTimer = null
      void supabase.auth.getSession().catch(() => undefined)
    }, 50)
  }

  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) recover()
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') recover()
  }

  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    lifecycleStarted = false
    if (recoverTimer) clearTimeout(recoverTimer)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
