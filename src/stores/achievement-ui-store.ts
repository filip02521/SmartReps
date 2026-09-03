import { create } from 'zustand'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'

type AchievementUiState = {
  /** Pending unlock sheets (live unlocks, not backfill). */
  queue: AchievementId[]
  /** Backfill summary count to show once. */
  backfillCount: number | null
  celebrationBlocked: boolean
  enqueueUnlocks: (rows: LocalAchievementUnlock[], backfill: boolean) => void
  shiftQueue: () => AchievementId | null
  clearBackfill: () => void
  setCelebrationBlocked: (v: boolean) => void
}

export const useAchievementUiStore = create<AchievementUiState>((set, get) => ({
  queue: [],
  backfillCount: null,
  celebrationBlocked: false,
  enqueueUnlocks(rows, backfill) {
    if (backfill) {
      set({ backfillCount: rows.length })
      return
    }
    const unseen = rows.filter((r) => !r.seenAt).map((r) => r.id)
    if (!unseen.length) return
    set((s) => ({ queue: [...s.queue, ...unseen.filter((id) => !s.queue.includes(id))] }))
  },
  shiftQueue() {
    const [head, ...rest] = get().queue
    set({ queue: rest })
    return head ?? null
  },
  clearBackfill() {
    set({ backfillCount: null })
  },
  setCelebrationBlocked(v) {
    set({ celebrationBlocked: v })
  },
}))
