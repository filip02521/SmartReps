import { OfflineBar } from '@/components/ux/Feedback'
import { useOnline } from '@/hooks/useOnline'

/** Offline banner for immersive routes outside AppLayout. */
export function GlobalOfflineBar() {
  const online = useOnline()
  if (online) return null
  return <OfflineBar />
}
