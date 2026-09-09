import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementUnlockSheet, AchievementBackfillSheet } from './AchievementUnlockSheet'
import { listUnseenUnlocks, hasBackfillFlag } from '@/lib/achievements/store'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'

function shouldDeferUnlockUi(pathname: string): boolean {
  // Block popups during active workout and setup — summary pages handle inline.
  return pathname.startsWith('/workout/') || pathname.startsWith('/setup/cycle/')
}

/**
 * Global host: shows unlock sheets after celebrations clear.
 * Mount once near app root (outside immersive workout is fine — sheets use portal).
 *
 * Rehydrates unseen unlocks from Dexie on mount so celebrations are not lost
 * if the app was killed while a sheet was deferred or open.
 */
export function AchievementHost() {
  const navigate = useNavigate()
  const location = useLocation()
  const queue = useAchievementUiStore((s) => s.queue)
  const backfillCount = useAchievementUiStore((s) => s.backfillCount)
  const celebrationBlocked = useAchievementUiStore((s) => s.celebrationBlocked)
  const summaryMode = useAchievementUiStore((s) => s.summaryMode)
  const removeFromQueue = useAchievementUiStore((s) => s.removeFromQueue)
  const enqueueUnlocks = useAchievementUiStore((s) => s.enqueueUnlocks)
  const clearBackfill = useAchievementUiStore((s) => s.clearBackfill)

  const [activeUnlock, setActiveUnlock] = useState<LocalAchievementUnlock | null>(null)
  const deferred = shouldDeferUnlockUi(location.pathname)
  // summaryMode = a summary page owns the queue (inline list), suppress popups everywhere
  const blocked = celebrationBlocked || deferred || summaryMode

  // Rehydrate unseen unlocks from Dexie on boot — if the app was killed while
  // a sheet was deferred/open, the in-memory queue was lost. Re-queue any
  // unlocks still marked unseen locally so the celebration is not skipped.
  //
  // SKIP on fresh devices (no backfill flag): auth-sync will pull remote
  // achievements and backfill-mark them as seen. If we enqueue here before
  // auth-sync runs, remote unseen would flood the user with celebration
  // sheets that backfill is supposed to suppress. Only rehydrate on devices
  // that have already been backfilled (i.e. have seen achievements before).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Fresh device — auth-sync owns the first-run flow.
        if (!hasBackfillFlag()) return
        const unseen = await listUnseenUnlocks()
        if (!cancelled && unseen.length > 0) {
          // Only re-queue if the in-memory queue is empty (avoid duplicates).
          const current = useAchievementUiStore.getState().queue
          if (current.length === 0) enqueueUnlocks(unseen, false)
        }
      } catch {
        /* best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (blocked) return
    if (activeUnlock) return
    if (backfillCount != null) return
    if (queue.length === 0) return
    // Peek the head WITHOUT shifting — shift happens on onDone so an unmount
    // (navigation away) doesn't lose the celebration permanently.
    const next = queue[0]
    if (next) setActiveUnlock(next)
  }, [queue, blocked, activeUnlock, backfillCount])

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
          onDone={() => {
            // Remove the EXACT achievement that was shown (by id), not just
            // queue[0] — the queue may have changed between peek and close
            // (e.g. another tab enqueued new unlocks, or clearQueue was called).
            if (activeUnlock) removeFromQueue(activeUnlock.id)
            setActiveUnlock(null)
          }}
        />
      )}
    </>
  )
}
