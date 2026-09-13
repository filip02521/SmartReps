import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

/**
 * Reactive auth state for UI decisions (e.g. whether hosted AI is available).
 * Returns `null` while the initial session check is pending — callers should
 * treat it as "unknown" and avoid flashing gated UI.
 */
export function useSupabaseAuth(): { loggedIn: boolean | null } {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(
    isSupabaseConfigured ? null : false,
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoggedIn(false)
      return
    }
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLoggedIn(!!data.session?.user)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return { loggedIn }
}
