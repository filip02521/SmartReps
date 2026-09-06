import { db } from '@/lib/db'
import { useAppStore, type UserSettings } from '@/stores/app-store'
import type {
  ActiveCustomWorkoutState,
  ActiveWorkoutState,
  BodyWeightEntry,
  LocalAchievementUnlockRow,
  LocalAiInsight,
  LocalCustomPlan,
  LocalCustomProgramProgress,
  LocalExercise,
  LocalMaxTest,
  LocalProgramProgress,
  LocalWorkoutSession,
  SessionTombstone,
  CustomPlanTombstone,
  ExerciseTombstone,
  BodyWeightTombstone,
} from '@/lib/db'

export type BackupSnapshotV1 = {
  version: 1
  exportedAt: string
  settings: UserSettings
  programProgress: LocalProgramProgress[]
  workoutSessions: LocalWorkoutSession[]
  maxTests: LocalMaxTest[]
  activeWorkout?: ActiveWorkoutState[]
}

export type BackupSnapshotV2 = {
  version: 2
  exportedAt: string
  settings: UserSettings
  programProgress: LocalProgramProgress[]
  workoutSessions: LocalWorkoutSession[]
  maxTests: LocalMaxTest[]
  activeWorkout?: ActiveWorkoutState[]
  exercises: LocalExercise[]
  customPlans: LocalCustomPlan[]
  customProgramProgress: LocalCustomProgramProgress[]
  activeCustomWorkout?: ActiveCustomWorkoutState[]
}

export type BackupSnapshotV3 = {
  version: 3
  exportedAt: string
  settings: UserSettings
  programProgress: LocalProgramProgress[]
  workoutSessions: LocalWorkoutSession[]
  maxTests: LocalMaxTest[]
  activeWorkout?: ActiveWorkoutState[]
  exercises: LocalExercise[]
  customPlans: LocalCustomPlan[]
  customProgramProgress: LocalCustomProgramProgress[]
  activeCustomWorkout?: ActiveCustomWorkoutState[]
  bodyWeight: BodyWeightEntry[]
  achievementUnlocks: LocalAchievementUnlockRow[]
  sessionTombstones: SessionTombstone[]
  customPlanTombstones?: CustomPlanTombstone[]
  exerciseTombstones?: ExerciseTombstone[]
  bodyWeightTombstones?: BodyWeightTombstone[]
  aiInsights: LocalAiInsight[]
}

export type BackupSnapshot = BackupSnapshotV1 | BackupSnapshotV2 | BackupSnapshotV3

export async function exportBackupSnapshot(): Promise<BackupSnapshotV3> {
  const { settings } = useAppStore.getState()
  const [
    programProgress,
    workoutSessions,
    maxTests,
    activeWorkout,
    exercises,
    customPlans,
    customProgramProgress,
    activeCustomWorkout,
    bodyWeight,
    achievementUnlocks,
    sessionTombstones,
    aiInsights,
    customPlanTombstones,
    exerciseTombstones,
    bodyWeightTombstones,
  ] = await Promise.all([
    db.programProgress.toArray(),
    db.workoutSessions.toArray(),
    db.maxTests.toArray(),
    db.activeWorkout.toArray(),
    db.exercises.toArray(),
    db.customPlans.toArray(),
    db.customProgramProgress.toArray(),
    db.activeCustomWorkout.toArray(),
    db.bodyWeight.toArray(),
    db.achievementUnlocks.toArray(),
    db.sessionTombstones.toArray(),
    db.aiInsights.toArray(),
    db.customPlanTombstones.toArray(),
    db.exerciseTombstones.toArray(),
    db.bodyWeightTombstones.toArray(),
  ])

  // Strip aiApiKey from exported settings — it's LOCAL-ONLY and must never
  // leave the device via a backup file (security: cross-device secret leak).
  const { aiApiKey: _stripped, ...safeSettings } = settings

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: safeSettings as UserSettings,
    programProgress,
    workoutSessions,
    maxTests,
    activeWorkout: activeWorkout.length ? activeWorkout : undefined,
    exercises,
    customPlans,
    customProgramProgress,
    activeCustomWorkout: activeCustomWorkout.length ? activeCustomWorkout : undefined,
    bodyWeight,
    achievementUnlocks,
    sessionTombstones,
    customPlanTombstones,
    exerciseTombstones,
    bodyWeightTombstones,
    aiInsights,
  }
}

/** Alias for callers expecting buildBackupSnapshot (Phase C compat). */
export const buildBackupSnapshot = exportBackupSnapshot

export function serializeBackup(snapshot: BackupSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

export function downloadBackupJson(snapshot: BackupSnapshot, filename?: string) {
  const name =
    filename ??
    `smartreps-backup-${snapshot.exportedAt.slice(0, 10)}.json`
  const blob = new Blob([serializeBackup(snapshot)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCustomPlanJson(plan: LocalCustomPlan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `smartreps-plan-${plan.name.replace(/\s+/g, '-').slice(0, 40)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
