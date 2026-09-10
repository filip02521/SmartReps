import { useEffect, useState } from 'react'
import { countUnseenUnlocks } from '@/lib/achievements/store'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'

/**
 * Tracks the count of unseen achievement unlocks for nav badges.
 * Re-checks on window focus, after sync completes, and when an
 * achievement is marked as seen (via custom event).
 */
export function useUnseenAchievements(): number {
  const hydrated = useStoreHydrated()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [count, setCount] = useState(0)

  const refresh = () => {
    void countUnseenUnlocks().then(setCount)
  }

  useEffect(() => {
    if (!hydrated) return
    refresh()
  }, [hydrated, lastSyncedAt])

  // Re-check on window focus (returning from another tab/page)
  useEffect(() => {
    if (!hydrated) return
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [hydrated])

  // Re-check when an achievement is marked as seen
  useEffect(() => {
    if (!hydrated) return
    const onSeen = () => refresh()
    window.addEventListener('achievements:seen', onSeen)
    return () => window.removeEventListener('achievements:seen', onSeen)
  }, [hydrated])

  return count
}
