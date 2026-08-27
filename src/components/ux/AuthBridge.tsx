import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { handleAuthSession } from '@/lib/auth-sync'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

/**
 * Global auth bridge: magic-link returns to /setup/login (or any route).
 * On SIGNED_IN / INITIAL_SESSION: account guard + sync (+ navigate on sign-in).
 *
 * Sync/navigation dedupe lives in auth-sync (runAuthenticatedSync) and
 * post-auth-navigation (navigateAfterAuth) — do not skip SIGNED_IN while
 * INITIAL_SESSION is in flight or magic-link navigation can be lost.
 */
export function AuthBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let initialSessionHandled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return
      if (!session) return

      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandled) return
        initialSessionHandled = true
      }

      try {
        await handleAuthSession(event, navigate)
      } catch {
        if (event === 'SIGNED_IN') {
          showToast(pl.toastSyncFailed, 'error')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}
