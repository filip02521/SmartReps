import { runAuthenticatedSync } from '@/lib/auth-sync'
import { useAppStore } from '@/stores/app-store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

/** Online listener + boot sync after store hydration (deduped via auth-sync lock). */
export function setupOnlineSync() {
  if (typeof window === 'undefined') return () => {}

  let resumeSyncTimer: ReturnType<typeof setTimeout> | null = null

  const triggerSync = (opts: Parameters<typeof runAuthenticatedSync>[0]) => {
    void (async () => {
      if (isSupabaseConfigured) {
        await supabase.auth.getSession().catch(() => undefined)
      }
      await runAuthenticatedSync(opts)
    })()
  }

  const onOnline = () => {
    triggerSync({ showSuccessToast: true, showFailureToast: true })
  }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    if (resumeSyncTimer) clearTimeout(resumeSyncTimer)
    resumeSyncTimer = setTimeout(() => {
      resumeSyncTimer = null
      triggerSync({
        showSuccessToast: false,
        showFailureToast: false,
        silentOffline: true,
      })
    }, 300)
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  void useAppStore.persist.onFinishHydration(() => {
    triggerSync({
      showSuccessToast: false,
      showFailureToast: false,
      silentOffline: true,
    })
  })

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    if (resumeSyncTimer) clearTimeout(resumeSyncTimer)
  }
}
