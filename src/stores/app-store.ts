import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Program } from '@/data/plans/types'
import { pushProfileSettingsOnly } from '@/lib/sync'

export type EnabledWorkout =
  | { kind: 'builtin'; program: Program }
  | { kind: 'custom'; planId: string }

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
  /** Custom plans shown on dashboard (Faza 4). Builtin still uses enabledPrograms. */
  enabledCustomPlanIds: string[]
  /** When true, enabledCustomPlanIds is authoritative (empty = hide all on home). */
  customPlansFilterExplicit: boolean
  onboardingComplete: boolean
  /** Public author name for community catalog (synced to profiles.display_name). */
  displayName?: string
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

export type PendingCustomStart = {
  customPlanId: string
  planName: string
  navigateToWorkout?: boolean
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
  pendingCustomStart: PendingCustomStart | null
  testDraft: TestDraft | null
  setupQueue: Program[]
  /** Last Supabase user id on this device — detects account switch on shared devices. */
  lastAuthUserId: string | null
  /** Bumped when enabledPrograms changes — LWW sync with profiles.enabled_programs. */
  enabledProgramsUpdatedAt: string | null
  /** Bumped when enabledCustomPlanIds / filter explicit change — LWW with profiles.enabled_workouts. */
  enabledCustomWorkoutsUpdatedAt: string | null
  /** Bumped when theme/timer/keepScreenOn/reminderHour change — LWW with profiles. */
  uiSettingsUpdatedAt: string | null
  /** ISO timestamp of last successful authenticated sync on this device. */
  lastSyncedAt: string | null
  /** Soft A2HS / install coach flags */
  hasCompletedFirstWorkout: boolean
  hasDismissedInstallPrompt: boolean
  hasSeenStandaloneLoginCoach: boolean
  /** Home tip dismiss (id + local calendar day YYYY-MM-DD). */
  dismissedHomeTipId: string | null
  dismissedHomeTipDay: string | null
  /** LoginPromptPolicy — Summary post-D1 cloud backup prompt shown once. */
  hasSeenLoginCloudPrompt: boolean
  dismissedLoginBackupTip: boolean
  /** Sticky dismiss for habit_met home tip (3 sessions / 14d). */
  dismissedHabitMetTip: boolean
  /** Last sync failure reason for SyncStatusPanel (A1/A2). */
  lastSyncFailureReason: string | null
  setSettings: (partial: Partial<UserSettings>) => void
  setPendingTest: (test: PendingTest | null) => void
  clearPendingTest: () => void
  setPendingStart: (start: PendingStart | null) => void
  clearPendingStart: () => void
  setPendingCustomStart: (start: PendingCustomStart | null) => void
  clearPendingCustomStart: () => void
  setTestDraft: (draft: TestDraft | null) => void
  clearTestDraft: () => void
  setSetupQueue: (queue: Program[]) => void
  shiftSetupQueue: () => Program | undefined
  setLastSyncedAt: (iso: string | null) => void
  setHasCompletedFirstWorkout: (v: boolean) => void
  setHasDismissedInstallPrompt: (v: boolean) => void
  setHasSeenStandaloneLoginCoach: (v: boolean) => void
  dismissHomeTip: (id: string, dayKey: string) => void
  setHasSeenLoginCloudPrompt: (v: boolean) => void
  setDismissedLoginBackupTip: (v: boolean) => void
  setDismissedHabitMetTip: (v: boolean) => void
  setLastSyncFailureReason: (reason: string | null) => void
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
  enabledCustomPlanIds: [],
  customPlansFilterExplicit: false,
  onboardingComplete: false,
  displayName: '',
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings },
      pendingTest: null,
      pendingStart: null,
      pendingCustomStart: null,
      testDraft: null,
      setupQueue: [],
      lastAuthUserId: null,
      enabledProgramsUpdatedAt: null,
      enabledCustomWorkoutsUpdatedAt: null,
      uiSettingsUpdatedAt: null,
      lastSyncedAt: null,
      hasCompletedFirstWorkout: false,
      hasDismissedInstallPrompt: false,
      hasSeenStandaloneLoginCoach: false,
      dismissedHomeTipId: null,
      dismissedHomeTipDay: null,
      hasSeenLoginCloudPrompt: false,
      dismissedLoginBackupTip: false,
      dismissedHabitMetTip: false,
      lastSyncFailureReason: null,
      setSettings: (partial) =>
        set((s) => {
          const nextSettings = { ...s.settings, ...partial }
          const patch: Partial<AppStore> = { settings: nextSettings }
          if (partial.enabledPrograms) {
            patch.enabledProgramsUpdatedAt = new Date().toISOString()
          }
          if (
            partial.enabledCustomPlanIds !== undefined ||
            partial.customPlansFilterExplicit !== undefined
          ) {
            patch.enabledCustomWorkoutsUpdatedAt = new Date().toISOString()
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
      setPendingCustomStart: (pendingCustomStart) => set({ pendingCustomStart }),
      clearPendingCustomStart: () => set({ pendingCustomStart: null }),
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
      dismissHomeTip: (dismissedHomeTipId, dismissedHomeTipDay) =>
        set({ dismissedHomeTipId, dismissedHomeTipDay }),
      setHasSeenLoginCloudPrompt: (hasSeenLoginCloudPrompt) => set({ hasSeenLoginCloudPrompt }),
      setDismissedLoginBackupTip: (dismissedLoginBackupTip) => set({ dismissedLoginBackupTip }),
      setDismissedHabitMetTip: (dismissedHabitMetTip) => set({ dismissedHabitMetTip }),
      setLastSyncFailureReason: (lastSyncFailureReason) => set({ lastSyncFailureReason }),
    }),
    {
      name: 'smartreps-app',
      version: 7,
      migrate: (persisted, fromVersion) => {
        const p = (persisted ?? {}) as Partial<AppStore> & { settings?: Partial<UserSettings> }
        const baseSettings: UserSettings = {
          ...defaultSettings,
          ...(p.settings ?? {}),
          customPlansFilterExplicit: p.settings?.customPlansFilterExplicit ?? false,
        }
        const base = {
          settings: baseSettings,
          pendingTest: p.pendingTest ?? null,
          pendingStart: p.pendingStart ?? null,
          pendingCustomStart: p.pendingCustomStart ?? null,
          setupQueue: p.setupQueue ?? [],
          lastAuthUserId: p.lastAuthUserId ?? null,
          enabledProgramsUpdatedAt: p.enabledProgramsUpdatedAt ?? null,
          enabledCustomWorkoutsUpdatedAt: p.enabledCustomWorkoutsUpdatedAt ?? null,
          uiSettingsUpdatedAt: p.uiSettingsUpdatedAt ?? null,
          lastSyncedAt: p.lastSyncedAt ?? null,
          hasCompletedFirstWorkout: p.hasCompletedFirstWorkout ?? false,
          hasDismissedInstallPrompt: p.hasDismissedInstallPrompt ?? false,
          hasSeenStandaloneLoginCoach: p.hasSeenStandaloneLoginCoach ?? false,
          dismissedHomeTipId: p.dismissedHomeTipId ?? null,
          dismissedHomeTipDay: p.dismissedHomeTipDay ?? null,
        }
        if (fromVersion < 4) {
          return {
            ...base,
            hasSeenLoginCloudPrompt: false,
            dismissedLoginBackupTip: false,
            dismissedHabitMetTip: false,
            lastSyncFailureReason: null,
          }
        }
        return {
          ...base,
          hasSeenLoginCloudPrompt: p.hasSeenLoginCloudPrompt ?? false,
          dismissedLoginBackupTip: p.dismissedLoginBackupTip ?? false,
          dismissedHabitMetTip:
            fromVersion < 7 ? false : (p.dismissedHabitMetTip ?? false),
          lastSyncFailureReason: p.lastSyncFailureReason ?? null,
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
        pendingCustomStart: s.pendingCustomStart,
        setupQueue: s.setupQueue,
        lastAuthUserId: s.lastAuthUserId,
        enabledProgramsUpdatedAt: s.enabledProgramsUpdatedAt,
        enabledCustomWorkoutsUpdatedAt: s.enabledCustomWorkoutsUpdatedAt,
        uiSettingsUpdatedAt: s.uiSettingsUpdatedAt,
        lastSyncedAt: s.lastSyncedAt,
        hasCompletedFirstWorkout: s.hasCompletedFirstWorkout,
        hasDismissedInstallPrompt: s.hasDismissedInstallPrompt,
        hasSeenStandaloneLoginCoach: s.hasSeenStandaloneLoginCoach,
        dismissedHomeTipId: s.dismissedHomeTipId,
        dismissedHomeTipDay: s.dismissedHomeTipDay,
        hasSeenLoginCloudPrompt: s.hasSeenLoginCloudPrompt,
        dismissedLoginBackupTip: s.dismissedLoginBackupTip,
        dismissedHabitMetTip: s.dismissedHabitMetTip,
        lastSyncFailureReason: s.lastSyncFailureReason,
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

function stringArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

useAppStore.subscribe((state, prev) => {
  if (!storeHydrated) return
  if (!programsEqual(state.settings.enabledPrograms, prev.settings.enabledPrograms)) {
    void pushProfileSettingsOnly()
  } else if (
    !stringArraysEqual(state.settings.enabledCustomPlanIds, prev.settings.enabledCustomPlanIds) ||
    state.settings.customPlansFilterExplicit !== prev.settings.customPlansFilterExplicit
  ) {
    void pushProfileSettingsOnly()
  } else if (!uiSettingsEqual(state.settings, prev.settings)) {
    void pushProfileSettingsOnly()
  }
})
