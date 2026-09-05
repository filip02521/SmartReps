import { db } from '@/lib/db'
import { useAppStore, defaultSettings } from '@/stores/app-store'
import { useWorkoutStore } from '@/stores/workout-store'
import { cancelReminder } from '@/lib/notifications'
import { clearSignedOutPreference } from '@/lib/auth-lifecycle'

/** Wipe IndexedDB + persisted app settings (logout / privacy / account switch).
 *  AI API keys are local-only prefs (never synced to cloud) and are preserved
 *  so the user doesn't have to re-enter them after logout/clear or account switch. */
export async function clearAllLocalData(): Promise<void> {
  cancelReminder()
  try {
    const { unsubscribeWebPush } = await import('@/lib/web-push')
    await unsubscribeWebPush()
  } catch {
    // best-effort — clearing local data must not fail on push unsubscribe
  }
  await Promise.all([
    db.programProgress.clear(),
    db.workoutSessions.clear(),
    db.activeWorkout.clear(),
    db.activeCustomWorkout.clear(),
    db.syncQueue.clear(),
    db.maxTests.clear(),
    db.exercises.clear(),
    db.customPlans.clear(),
    db.customProgramProgress.clear(),
    db.aiInsights.clear(),
    db.aiAnalysisCache.clear(),
    db.sessionTombstones.clear(),
  ])
  useWorkoutStore.getState().reset()
  try {
    const { useCustomWorkoutStore } = await import('@/stores/custom-workout-store')
    useCustomWorkoutStore.getState().reset()
  } catch {
    // store may be unavailable in rare test harnesses
  }
  // Preserve AI API keys across clear — they're local-only, never synced,
  // and re-entering them after every logout is frustrating.
  const prevSettings = useAppStore.getState().settings
  useAppStore.setState({
    settings: {
      ...defaultSettings,
      aiApiKey: prevSettings.aiApiKey,
      aiModel: prevSettings.aiModel,
      aiBaseUrl: prevSettings.aiBaseUrl,
      aiProactiveCoach: prevSettings.aiProactiveCoach,
      aiReasoningEffort: prevSettings.aiReasoningEffort,
      language: prevSettings.language,
    },
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
    hasSeenLoginCloudPrompt: false,
    dismissedLoginBackupTip: false,
    dismissedHabitMetTip: false,
    lastSyncFailureReason: null,
    dismissedHomeTipId: null,
    dismissedHomeTipDay: null,
  })
  // No remembered cloud account → drop voluntary/unexpected sign-out prefs.
  clearSignedOutPreference()
}
