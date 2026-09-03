import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementUnlockSheet, AchievementBackfillSheet } from './AchievementUnlockSheet'
import type { AchievementId } from '@/lib/achievements/types'

function shouldDeferUnlockUi(pathname: string): boolean {
  // Plan: show unlock after summary / cycle celebration — not over active workout chrome.
  return (
    pathname.includes('/summary') ||
    pathname.startsWith('/workout/') ||
    pathname.startsWith('/setup/cycle/')
  )
}

/**
 * Global host: shows unlock sheets after celebrations clear.
 * Mount once near app root (outside immersive workout is fine — sheets use portal).
 */
export function AchievementHost() {
  const navigate = useNavigate()
  const location = useLocation()
  const queue = useAchievementUiStore((s) => s.queue)
  const backfillCount = useAchievementUiStore((s) => s.backfillCount)
  const celebrationBlocked = useAchievementUiStore((s) => s.celebrationBlocked)
  const shiftQueue = useAchievementUiStore((s) => s.shiftQueue)
  const clearBackfill = useAchievementUiStore((s) => s.clearBackfill)

  const [activeId, setActiveId] = useState<AchievementId | null>(null)
  const deferred = shouldDeferUnlockUi(location.pathname)
  const blocked = celebrationBlocked || deferred

  useEffect(() => {
    if (blocked) return
    if (activeId) return
    if (backfillCount != null) return
    if (queue.length === 0) return
    const next = shiftQueue()
    if (next) setActiveId(next)
  }, [queue, blocked, activeId, backfillCount, shiftQueue])

  return (
    <>
      {backfillCount != null && !blocked && (
        <AchievementBackfillSheet
          count={backfillCount}
          onClose={clearBackfill}
          onSeeAll={() => {
            clearBackfill()
            navigate('/progress?tab=achievements')
          }}
        />
      )}
      {!blocked && (
        <AchievementUnlockSheet
          achievementId={activeId}
          onDone={() => setActiveId(null)}
        />
      )}
    </>
  )
}
