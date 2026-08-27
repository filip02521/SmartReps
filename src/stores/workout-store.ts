import { create } from 'zustand'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { RestTimerState } from '@/lib/rest-timer'
import type { Program } from '@/data/plans/types'

type WorkoutStore = {
  sessionId: string | null
  program: Program | null
  cycleId: string | null
  dayNumber: number
  cycleAttempt: number
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimer: RestTimerState | null
  failedRetryUsed: boolean
  immersive: boolean

  startSession: (params: {
    sessionId: string
    program: Program
    cycleId: string
    dayNumber: number
    cycleAttempt: number
  }) => void
  resumeSession: (params: {
    sessionId: string
    program: Program
    cycleId: string
    dayNumber: number
    cycleAttempt: number
    currentSetIndex: number
    setResults: SetResultDraft[]
    restTimer: RestTimerState | null
  }) => void
  completeSet: (result: SetResultDraft) => void
  /** Undo last completed set so the user can correct reps. Returns removed result or null. */
  undoLastSet: () => SetResultDraft | null
  setRestTimer: (timer: RestTimerState | null) => void
  setCurrentSetIndex: (index: number) => void
  setFailedRetryUsed: (v: boolean) => void
  setImmersive: (v: boolean) => void
  reset: () => void
}

const initialState = {
  sessionId: null,
  program: null,
  cycleId: null,
  dayNumber: 1,
  cycleAttempt: 1,
  currentSetIndex: 0,
  setResults: [] as SetResultDraft[],
  restTimer: null,
  failedRetryUsed: false,
  immersive: false,
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  ...initialState,

  startSession: (params) =>
    set({
      ...initialState,
      ...params,
      currentSetIndex: 0,
      setResults: [],
      immersive: true,
    }),

  resumeSession: (params) =>
    set({ ...params, failedRetryUsed: false, immersive: true }),

  completeSet: (result) =>
    set((s) => ({
      setResults: [...s.setResults.filter((r) => r.setNumber !== result.setNumber), result],
      currentSetIndex: s.currentSetIndex + 1,
    })),

  undoLastSet: () => {
    const s = get()
    if (s.currentSetIndex <= 0 || s.setResults.length === 0) return null
    const setNumber = s.currentSetIndex
    const removed = s.setResults.find((r) => r.setNumber === setNumber)
    if (!removed) return null
    set({
      setResults: s.setResults.filter((r) => r.setNumber !== setNumber),
      currentSetIndex: setNumber - 1,
      restTimer: { mode: 'idle', totalSec: 0, remainingSec: 0, startedAt: null },
    })
    return removed
  },

  setRestTimer: (restTimer) => set({ restTimer }),
  setCurrentSetIndex: (currentSetIndex) => set({ currentSetIndex }),
  setFailedRetryUsed: (failedRetryUsed) => set({ failedRetryUsed }),
  setImmersive: (immersive) => {
    if (get().immersive === immersive) return
    set({ immersive })
  },
  reset: () => set(initialState),
}))
