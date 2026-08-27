import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { handleAuthSession } from '@/lib/auth-sync'

/**
 * Global auth bridge: magic-link returns to /setup/login (or any route).
 * On SIGNED_IN / INITIAL_SESSION: account guard + sync (+ navigate on sign-in).
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
      } catch (err) {
        console.warn('[auth] handleAuthSession failed', err)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}
