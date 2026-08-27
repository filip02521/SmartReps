import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { pullRemoteData, syncAllLocalData } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

async function waitForHydration(timeoutMs = 3000): Promise<void> {
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

/**
 * Global auth bridge: magic-link returns to /setup/login (or any route).
 * On SIGNED_IN, push local first (incl. active deletes), then pull, then finish gates.
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
        await waitForHydration()

        // Push first so local active_workout deletes land before pull can resurrect them
        const push = await syncAllLocalData()
        const pull = await pullRemoteData()
        const flush = await syncAllLocalData()
        if (!push.ok || !pull.ok || !flush.ok) {
          showToast(pl.toastSyncFailed, 'error')
        }

        const { pendingStart, setupQueue, settings } = useAppStore.getState()
        const needsSetupGate =
          !!pendingStart ||
          setupQueue.length > 0 ||
          !settings.onboardingComplete
        if (needsSetupGate || window.location.pathname === '/setup/login') {
          await navigateAfterAuth(navigate)
        }
      } catch {
        showToast(pl.toastSyncFailed, 'error')
      } finally {
        handlingRef.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}
