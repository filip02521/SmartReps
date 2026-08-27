import { runAuthenticatedSync } from '@/lib/auth-sync'
import { useAppStore } from '@/stores/app-store'

/** Online listener + boot sync after store hydration (deduped via auth-sync lock). */
export function setupOnlineSync() {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => {
    void runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
  }

  window.addEventListener('online', onOnline)

  void useAppStore.persist.onFinishHydration(() => {
    void runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
  })

  return () => window.removeEventListener('online', onOnline)
}
