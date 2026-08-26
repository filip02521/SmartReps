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

type AppStore = {
  settings: UserSettings
  pendingTest: { program: Program; reps: number; cycleId: string } | null
  pendingStart: { program: Program; cycleId: string; cycleName: string; celebration?: string; navigateToWorkout?: boolean } | null
  setupQueue: Program[]
  setSettings: (partial: Partial<UserSettings>) => void
  setPendingTest: (test: AppStore['pendingTest']) => void
  clearPendingTest: () => void
  setPendingStart: (start: AppStore['pendingStart']) => void
  clearPendingStart: () => void
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
      setupQueue: [],
      setSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      setPendingTest: (pendingTest) => set({ pendingTest }),
      clearPendingTest: () => set({ pendingTest: null }),
      setPendingStart: (pendingStart) => set({ pendingStart }),
      clearPendingStart: () => set({ pendingStart: null }),
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
    { name: 'smartreps-app' },
  ),
)
