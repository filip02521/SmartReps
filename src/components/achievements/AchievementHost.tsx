import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementUnlockSheet, AchievementBackfillSheet } from './AchievementUnlockSheet'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'

function shouldDeferUnlockUi(pathname: string): boolean {
  // Block popups during active workout and setup — summary pages handle inline.
  return pathname.startsWith('/workout/') || pathname.startsWith('/setup/cycle/')
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
  const summaryMode = useAchievementUiStore((s) => s.summaryMode)
  const shiftQueue = useAchievementUiStore((s) => s.shiftQueue)
  const clearBackfill = useAchievementUiStore((s) => s.clearBackfill)

  const [activeUnlock, setActiveUnlock] = useState<LocalAchievementUnlock | null>(null)
  const deferred = shouldDeferUnlockUi(location.pathname)
  // summaryMode = a summary page owns the queue (inline list), suppress popups everywhere
  const blocked = celebrationBlocked || deferred || summaryMode

  useEffect(() => {
    if (blocked) return
    if (activeUnlock) return
    if (backfillCount != null) return
    if (queue.length === 0) return
    const next = shiftQueue()
    if (next) setActiveUnlock(next)
  }, [queue, blocked, activeUnlock, backfillCount, shiftQueue])

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
          achievementId={activeUnlock?.id ?? null}
          unlock={activeUnlock ?? undefined}
          onDone={() => setActiveUnlock(null)}
        />
      )}
    </>
  )
}
