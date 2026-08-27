import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Program } from '@/data/plans/types'

export type UserSettings = {
  theme: 'system' | 'dark' | 'light'
  highContrast: boolean
  timerSound: boolean
  timerVibration: boolean
  /** In-app reminder while the tab/PWA JS is alive — not Web Push. */
  workoutReminders: boolean
  /** Web Push reminders (requires installed PWA + VAPID + login). */
  pushNotifications: boolean
  /** Local hour 0–23 for reminders (in-app or push). */
  reminderHour: number
  /** When true, request Wake Lock during rest between sets. */
  keepScreenOn: boolean
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
  /** Manual cycle switch without a new max test. */
  isLevelChange?: boolean
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
  /** Last Supabase user id on this device — detects account switch on shared devices. */
  lastAuthUserId: string | null
  /** Bumped when enabledPrograms changes — LWW sync with profiles.enabled_programs. */
  enabledProgramsUpdatedAt: string | null
  /** Bumped when theme/timer/keepScreenOn/reminderHour change — LWW with profiles. */
  uiSettingsUpdatedAt: string | null
  /** ISO timestamp of last successful authenticated sync on this device. */
  lastSyncedAt: string | null
  /** Soft A2HS / install coach flags */
  hasCompletedFirstWorkout: boolean
  hasDismissedInstallPrompt: boolean
  hasSeenStandaloneLoginCoach: boolean
  setSettings: (partial: Partial<UserSettings>) => void
  setPendingTest: (test: PendingTest | null) => void
  clearPendingTest: () => void
  setPendingStart: (start: PendingStart | null) => void
  clearPendingStart: () => void
  setTestDraft: (draft: TestDraft | null) => void
  clearTestDraft: () => void
  setSetupQueue: (queue: Program[]) => void
  shiftSetupQueue: () => Program | undefined
  setLastSyncedAt: (iso: string | null) => void
  setHasCompletedFirstWorkout: (v: boolean) => void
  setHasDismissedInstallPrompt: (v: boolean) => void
  setHasSeenStandaloneLoginCoach: (v: boolean) => void
}

const UI_SYNC_KEYS: (keyof UserSettings)[] = [
  'theme',
  'timerSound',
  'timerVibration',
  'keepScreenOn',
  'reminderHour',
]

export const defaultSettings: UserSettings = {
  theme: 'system',
  highContrast: false,
  timerSound: true,
  timerVibration: true,
  workoutReminders: false,
  pushNotifications: false,
  reminderHour: 18,
  keepScreenOn: true,
  healthDisclaimerAccepted: false,
  hasSeenWorkoutHint: false,
  enabledPrograms: ['pushups'],
  onboardingComplete: false,
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings },
      pendingTest: null,
      pendingStart: null,
      testDraft: null,
      setupQueue: [],
      lastAuthUserId: null,
      enabledProgramsUpdatedAt: null,
      uiSettingsUpdatedAt: null,
      lastSyncedAt: null,
      hasCompletedFirstWorkout: false,
      hasDismissedInstallPrompt: false,
      hasSeenStandaloneLoginCoach: false,
      setSettings: (partial) =>
        set((s) => {
          const nextSettings = { ...s.settings, ...partial }
          const patch: Partial<AppStore> = { settings: nextSettings }
          if (partial.enabledPrograms) {
            patch.enabledProgramsUpdatedAt = new Date().toISOString()
          }
          if (UI_SYNC_KEYS.some((k) => k in partial)) {
            patch.uiSettingsUpdatedAt = new Date().toISOString()
          }
          return patch
        }),
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
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setHasCompletedFirstWorkout: (hasCompletedFirstWorkout) => set({ hasCompletedFirstWorkout }),
      setHasDismissedInstallPrompt: (hasDismissedInstallPrompt) => set({ hasDismissedInstallPrompt }),
      setHasSeenStandaloneLoginCoach: (hasSeenStandaloneLoginCoach) => set({ hasSeenStandaloneLoginCoach }),
    }),
    {
      name: 'smartreps-app',
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<AppStore> & { settings?: Partial<UserSettings> }
        return {
          settings: { ...defaultSettings, ...(p.settings ?? {}) },
          pendingTest: p.pendingTest ?? null,
          pendingStart: p.pendingStart ?? null,
          setupQueue: p.setupQueue ?? [],
          lastAuthUserId: p.lastAuthUserId ?? null,
          enabledProgramsUpdatedAt: p.enabledProgramsUpdatedAt ?? null,
          uiSettingsUpdatedAt: p.uiSettingsUpdatedAt ?? null,
          lastSyncedAt: p.lastSyncedAt ?? null,
          hasCompletedFirstWorkout: p.hasCompletedFirstWorkout ?? false,
          hasDismissedInstallPrompt: p.hasDismissedInstallPrompt ?? false,
          hasSeenStandaloneLoginCoach: p.hasSeenStandaloneLoginCoach ?? false,
        }
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStore>
        return {
          ...current,
          ...p,
          settings: { ...defaultSettings, ...current.settings, ...(p.settings ?? {}) },
        }
      },
      partialize: (s) => ({
        settings: s.settings,
        pendingTest: s.pendingTest,
        pendingStart: s.pendingStart,
        setupQueue: s.setupQueue,
        lastAuthUserId: s.lastAuthUserId,
        enabledProgramsUpdatedAt: s.enabledProgramsUpdatedAt,
        uiSettingsUpdatedAt: s.uiSettingsUpdatedAt,
        lastSyncedAt: s.lastSyncedAt,
        hasCompletedFirstWorkout: s.hasCompletedFirstWorkout,
        hasDismissedInstallPrompt: s.hasDismissedInstallPrompt,
        hasSeenStandaloneLoginCoach: s.hasSeenStandaloneLoginCoach,
      }),
    },
  ),
)

function programsEqual(a: Program[], b: Program[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i])
}

function uiSettingsEqual(
  a: UserSettings,
  b: UserSettings,
): boolean {
  return UI_SYNC_KEYS.every((k) => a[k] === b[k])
}

let storeHydrated = useAppStore.persist.hasHydrated()
useAppStore.persist.onFinishHydration(() => {
  storeHydrated = true
})

useAppStore.subscribe((state, prev) => {
  if (!storeHydrated) return
  if (!programsEqual(state.settings.enabledPrograms, prev.settings.enabledPrograms)) {
    void import('@/lib/sync').then((m) => m.pushProfileSettingsOnly())
  } else if (!uiSettingsEqual(state.settings, prev.settings)) {
    void import('@/lib/sync').then((m) => m.pushProfileSettingsOnly())
  }
})
