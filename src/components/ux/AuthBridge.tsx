import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { handleAuthSession } from '@/lib/auth-sync'
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        await notifyUnexpectedSessionLoss()
        return
      }

      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return

      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandled) return
        initialSessionHandled = true
        if (!session) {
          // Storage wiped or refresh failed before hydrate — explain if we remember a login.
          await notifyUnexpectedSessionLoss()
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
      stopLifecycle()
      subscription.unsubscribe()
    }
  }, [navigate])

  return null
}
