import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

/** Cleared after this SIGNED_OUT event is handled (same tick). */
const INTENTIONAL_SIGNOUT_KEY = 'sr-auth-intentional-signout'
/** Sticky until next successful login — suppresses "session lost" after voluntary logout. */
const USER_SIGNED_OUT_PREF_KEY = 'sr-auth-user-signed-out'

let lastSessionLostToastAt = 0
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

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function storageTake(key: string): boolean {
  let marked = false
  try {
    if (sessionStorage.getItem(key) === '1') {
      marked = true
      sessionStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
  try {
    if (localStorage.getItem(key) === '1') {
      marked = true
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
  return marked
}

function storageHas(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) === '1') return true
  } catch {
    // ignore
  }
  try {
    if (localStorage.getItem(key) === '1') return true
  } catch {
    // ignore
  }
  return false
}

function storageClear(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Call immediately before user-initiated signOut so we don't show "session lost". */
export function markIntentionalSignOut(): void {
  storageSet(INTENTIONAL_SIGNOUT_KEY, '1')
  storageSet(USER_SIGNED_OUT_PREF_KEY, '1')
}

/** After a successful login, allow future unexpected-loss toasts again. */
export function clearSignedOutPreference(): void {
  storageClear(USER_SIGNED_OUT_PREF_KEY)
  storageClear(INTENTIONAL_SIGNOUT_KEY)
}

export function consumeIntentionalSignOut(): boolean {
  return storageTake(INTENTIONAL_SIGNOUT_KEY)
}

export async function signOutUser(
  options?: Parameters<typeof supabase.auth.signOut>[0],
): Promise<void> {
  if (!isSupabaseConfigured) return
  markIntentionalSignOut()
  const { error } = await supabase.auth.signOut(options)
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    // Local session still present — don't suppress future unexpected-loss toasts.
    clearSignedOutPreference()
    if (error) throw error
  }
  // Session cleared locally: keep sticky signed-out pref even if remote revoke failed.
}

/** Toast once when cloud session disappeared but local progress account is remembered. */
export async function notifyUnexpectedSessionLoss(): Promise<void> {
  await waitForStoreHydration()
  if (!useAppStore.getState().lastAuthUserId) return
  if (storageHas(USER_SIGNED_OUT_PREF_KEY)) {
    consumeIntentionalSignOut()
    return
  }
  if (consumeIntentionalSignOut()) return

  const now = Date.now()
  if (now - lastSessionLostToastAt < 8000) return
  lastSessionLostToastAt = now
  showToast(pl.sessionLostReLogin, 'info')
}

/**
 * Recover session after iOS bfcache / PWA resume; keep auto-refresh under Supabase's
 * built-in visibility handler (do not call startAutoRefresh yourself).
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
    // First load is handled by GoTrue initialize; only re-check bfcache restores here.
    if (e.persisted) recover()
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') recover()
  }

  const onOnline = () => recover()

  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)

  return () => {
    lifecycleStarted = false
    if (recoverTimer) clearTimeout(recoverTimer)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
  }
}
