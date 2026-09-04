import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { NoticeCard, noticeIcon } from '@/components/ux/NoticeCard'
import { cn } from '@/lib/utils'
import { trackPwaUpdateReload } from '@/lib/analytics'
import { pl } from '@/i18n/pl'
import { CHROME_BOTTOM_ABOVE_TABS, Z_TOAST } from '@/lib/ui-chrome'

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

/** Shows a NoticeCard when a new service worker is waiting (registerType: prompt). */
export function PwaUpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    let registration: ServiceWorkerRegistration | undefined

    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedsRefresh(true)
        setUpdateFn(() => updateSW)
      },
      onOfflineReady() {
        // optional — app works offline after first load
      },
      onRegistered(reg) {
        registration = reg
        // Check for updates immediately after registration
        void reg?.update()
      },
    })

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void registration?.update()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // Fallback: periodic update check for browsers that don't fire visibilitychange
    // reliably (notably iOS Safari when PWA is launched from home screen).
    const interval = window.setInterval(() => {
      void registration?.update()
    }, UPDATE_CHECK_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      setUpdateFn(null)
    }
  }, [])

  if (!needsRefresh) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 mx-auto max-w-lg px-4',
        CHROME_BOTTOM_ABOVE_TABS,
      )}
      style={{ zIndex: Z_TOAST }}
    >
      <NoticeCard
        className="pointer-events-auto"
        tone="brand"
        icon={noticeIcon('brand')}
        title={pl.pwaUpdateTitle}
        message={pl.pwaUpdateBody}
        actionLabel={pl.pwaUpdateReload}
        onAction={() => {
          trackPwaUpdateReload()
          updateFn?.()
        }}
        dismissLabel={pl.pwaUpdateLater}
        onDismiss={() => setNeedsRefresh(false)}
        stackActions
      />
    </div>
  )
}
