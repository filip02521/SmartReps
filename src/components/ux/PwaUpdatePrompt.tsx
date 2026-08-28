import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { NoticeCard, noticeIcon } from '@/components/ux/NoticeCard'
import { trackPwaUpdateReload } from '@/lib/analytics'
import { pl } from '@/i18n/pl'

/** Shows a NoticeCard when a new service worker is waiting (registerType: prompt). */
export function PwaUpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedsRefresh(true)
        setUpdateFn(() => updateSW)
      },
      onOfflineReady() {
        // optional — app works offline after first load
      },
    })

    return () => {
      setUpdateFn(null)
    }
  }, [])

  if (!needsRefresh) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[var(--sr-z-toast)] mx-auto max-w-lg px-4">
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
