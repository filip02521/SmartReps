import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { pullRemoteData, syncAllLocalData } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'

/**
 * Global auth bridge: magic-link returns to /setup/login (or any route).
 * On SIGNED_IN, sync and finish pending setup gates even if Login unmounted.
 */
export function AuthBridge() {
  const navigate = useNavigate()
  const handlingRef = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== 'SIGNED_IN') return
      if (handlingRef.current) return
      handlingRef.current = true
      try {
        await pullRemoteData()
        await syncAllLocalData()
        const { pendingStart, setupQueue } = useAppStore.getState()
        if (pendingStart || setupQueue.length > 0) {
          await navigateAfterAuth(navigate)
        } else if (window.location.pathname === '/setup/login') {
          navigate('/', { replace: true })
        }
      } finally {
        handlingRef.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}
