import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Program } from '@/data/plans/types'

export type UserSettings = {
  theme: 'system' | 'dark' | 'light'
  highContrast: boolean
  timerSound: boolean
  timerVibration: boolean
  workoutReminders: boolean
  healthDisclaimerAccepted: boolean
  hasSeenWorkoutHint: boolean
  enabledPrograms: Program[]
  onboardingComplete: boolean
}

export type PendingTest = {
  program: Program
  reps: number
  cycleId: string
  /** Dexie id of max_tests row already written — re-confirm updates instead of insert. */
  committedMaxTestId?: number
}

export type PendingStart = {
  program: Program
  cycleId: string
  cycleName: string
  reps: number
  isRetest?: boolean
  celebration?: string
  navigateToWorkout?: boolean
  committedMaxTestId?: number
}

export type TestDraft = {
  program: Program
  reps: number
  warmup: boolean[]
}

type AppStore = {
  settings: UserSettings
  pendingTest: PendingTest | null
  pendingStart: PendingStart | null
  testDraft: TestDraft | null
  setupQueue: Program[]
  setSettings: (partial: Partial<UserSettings>) => void
  setPendingTest: (test: PendingTest | null) => void
  clearPendingTest: () => void
  setPendingStart: (start: PendingStart | null) => void
  clearPendingStart: () => void
  setTestDraft: (draft: TestDraft | null) => void
  clearTestDraft: () => void
  setSetupQueue: (queue: Program[]) => void
  shiftSetupQueue: () => Program | undefined
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: {
        theme: 'system',
        highContrast: false,
        timerSound: true,
        timerVibration: true,
        workoutReminders: false,
        healthDisclaimerAccepted: false,
        hasSeenWorkoutHint: false,
        enabledPrograms: ['pushups'],
        onboardingComplete: false,
      },
      pendingTest: null,
      pendingStart: null,
      testDraft: null,
      setupQueue: [],
      setSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      setPendingTest: (pendingTest) => set({ pendingTest }),
      clearPendingTest: () => set({ pendingTest: null }),
      setPendingStart: (pendingStart) => set({ pendingStart }),
      clearPendingStart: () => set({ pendingStart: null }),
      setTestDraft: (testDraft) => set({ testDraft }),
      clearTestDraft: () => set({ testDraft: null }),
      setSetupQueue: (setupQueue) => set({ setupQueue }),
      shiftSetupQueue: () => {
        let next: Program | undefined
        set((s) => {
          next = s.setupQueue[0]
          return { setupQueue: s.setupQueue.slice(1) }
        })
        return next
      },
    }),
    {
      name: 'smartreps-app',
      partialize: (s) => ({
        settings: s.settings,
        pendingTest: s.pendingTest,
        pendingStart: s.pendingStart,
        setupQueue: s.setupQueue,
        // testDraft is session-only — not persisted across reloads intentionally via omit
      }),
    },
  ),
)
