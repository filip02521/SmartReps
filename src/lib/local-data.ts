import { db } from '@/lib/db'
import { useAppStore } from '@/stores/app-store'
import { useWorkoutStore } from '@/stores/workout-store'
import { cancelReminder } from '@/lib/notifications'

/** Wipe IndexedDB + persisted app settings (logout / privacy / account switch). */
export async function clearAllLocalData(): Promise<void> {
  cancelReminder()
  await Promise.all([
    db.programProgress.clear(),
    db.workoutSessions.clear(),
    db.activeWorkout.clear(),
    db.syncQueue.clear(),
    db.maxTests.clear(),
  ])
  useWorkoutStore.getState().reset()
  useAppStore.setState({
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
    lastAuthUserId: null,
    enabledProgramsUpdatedAt: null,
  })
}
