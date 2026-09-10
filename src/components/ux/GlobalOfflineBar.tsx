import { OfflineBar } from '@/components/ux/Feedback'
import { useOnline } from '@/hooks/useOnline'
import { useAppStore } from '@/stores/app-store'
import { useEffect } from 'react'

/** Offline banner for immersive routes outside AppLayout. */
export function GlobalOfflineBar() {
  const online = useOnline()
  // Subscribe to language so the banner re-renders (pl.offline) on change
  // without remounting the whole chrome tree.
  useAppStore((s) => s.settings.language)

  useEffect(() => {
    document.documentElement.dataset.offline = online ? '0' : '1'
    return () => {
      delete document.documentElement.dataset.offline
    }
  }, [online])

  if (online) return null
  return <OfflineBar />
}
