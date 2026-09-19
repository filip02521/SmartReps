import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { handleAuthSession, runAuthenticatedSync } from '@/lib/auth-sync'
import { useAppStore } from '@/stores/app-store'
import {
  notifyUnexpectedSessionLoss,
  setupAuthLifecycle,
  clearSignedOutPreference,
} from '@/lib/auth-lifecycle'

/**
 * Global auth bridge: session restore / rare email-link returns.
 * Primary login is email OTP code on /setup/login.
 * On SIGNED_IN / INITIAL_SESSION: account guard + sync (+ navigate on sign-in).
 * On unexpected SIGNED_OUT: toast — local workout data is kept.
 */
export function AuthBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const stopLifecycle = setupAuthLifecycle()
    let initialSessionHandled = false
    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'SIGNED_OUT') {
        await notifyUnexpectedSessionLoss(navigate)
        return
      }

      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return

      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandled) return
        initialSessionHandled = true
        if (!session) {
          await notifyUnexpectedSessionLoss(navigate)
          return
        }
      }

      if (!session) return

      clearSignedOutPreference()

      try {
        await handleAuthSession(event, navigate)
      } catch (err) {
        console.warn('[auth] handleAuthSession failed', err)
      }
    })

    return () => {
      cancelled = true
      stopLifecycle()
      subscription.unsubscribe()
    }
  }, [navigate])

  // Auto-sync on reconnect + app foreground. Writes only enqueue into
  // syncQueue — without this, a long-lived PWA session that went
  // offline→online held unpushed data until the next cold start or a
  // manual "Synchronizuj". Debounced on lastSyncedAt; silent, logged-out
  // users no-op inside runAuthenticatedSync.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const MIN_INTERVAL_MS = 60_000
    const maybeAutoSync = () => {
      if (!navigator.onLine) return
      const { lastSyncedAt } = useAppStore.getState()
      if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < MIN_INTERVAL_MS) return
      void runAuthenticatedSync({ silentOffline: true })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeAutoSync()
    }
    window.addEventListener('online', maybeAutoSync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', maybeAutoSync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
