import { OfflineBar } from '@/components/ux/Feedback'
import { useOnline } from '@/hooks/useOnline'
import { useEffect } from 'react'

/** Offline banner for immersive routes outside AppLayout. */
export function GlobalOfflineBar() {
  const online = useOnline()

  useEffect(() => {
    document.documentElement.dataset.offline = online ? '0' : '1'
    return () => {
      delete document.documentElement.dataset.offline
    }
  }, [online])

  if (online) return null
  return <OfflineBar />
}
