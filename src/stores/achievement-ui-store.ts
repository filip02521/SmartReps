import { create } from 'zustand'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'

type AchievementUiState = {
  /** Pending unlock sheets (live unlocks, not backfill). */
  queue: LocalAchievementUnlock[]
  /** Backfill summary count to show once. */
  backfillCount: number | null
  celebrationBlocked: boolean
  /** When true, summary page owns the queue — AchievementHost suppresses popups. */
  summaryMode: boolean
  enqueueUnlocks: (rows: LocalAchievementUnlock[], backfill: boolean) => void
  shiftQueue: () => LocalAchievementUnlock | null
  clearQueue: () => void
  clearBackfill: () => void
  setCelebrationBlocked: (v: boolean) => void
  setSummaryMode: (v: boolean) => void
}

export const useAchievementUiStore = create<AchievementUiState>((set, get) => ({
  queue: [],
  backfillCount: null,
  celebrationBlocked: false,
  summaryMode: false,
  enqueueUnlocks(rows, backfill) {
    if (backfill) {
      set({ backfillCount: rows.length })
      return
    }
    const unseen = rows.filter((r) => !r.seenAt)
    if (!unseen.length) return
    set((s) => {
      const existingIds = new Set(s.queue.map((r) => r.id))
      const fresh = unseen.filter((r) => !existingIds.has(r.id))
      return { queue: [...s.queue, ...fresh] }
    })
  },
  shiftQueue() {
    const [head, ...rest] = get().queue
    set({ queue: rest })
    return head ?? null
  },
  clearQueue() {
    set({ queue: [] })
  },
  clearBackfill() {
    set({ backfillCount: null })
  },
  setCelebrationBlocked(v) {
    set({ celebrationBlocked: v })
  },
  setSummaryMode(v) {
    set({ summaryMode: v })
  },
}))
