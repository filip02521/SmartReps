import { useEffect, useState } from 'react'
import { countUnseenUnlocks } from '@/lib/achievements/store'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'

/**
 * Tracks the count of unseen achievement unlocks for nav badges.
 * Re-checks on window focus and after sync completes.
 */
export function useUnseenAchievements(): number {
  const hydrated = useStoreHydrated()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    void countUnseenUnlocks().then((n) => {
      if (!cancelled) setCount(n)
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, lastSyncedAt])

  // Re-check on window focus (returning from another tab/page)
  useEffect(() => {
    if (!hydrated) return
    const onFocus = () => {
      void countUnseenUnlocks().then(setCount)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [hydrated])

  return count
}
