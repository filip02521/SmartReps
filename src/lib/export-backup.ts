import { db } from '@/lib/db'
import { useAppStore, type UserSettings } from '@/stores/app-store'
import type {
  ActiveCustomWorkoutState,
  ActiveWorkoutState,
  LocalCustomPlan,
  LocalCustomProgramProgress,
  LocalExercise,
  LocalMaxTest,
  LocalProgramProgress,
  LocalWorkoutSession,
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

export type BackupSnapshot = BackupSnapshotV1 | BackupSnapshotV2

export async function exportBackupSnapshot(): Promise<BackupSnapshotV2> {
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
  ] = await Promise.all([
    db.programProgress.toArray(),
    db.workoutSessions.toArray(),
    db.maxTests.toArray(),
    db.activeWorkout.toArray(),
    db.exercises.toArray(),
    db.customPlans.toArray(),
    db.customProgramProgress.toArray(),
    db.activeCustomWorkout.toArray(),
  ])

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    programProgress,
    workoutSessions,
    maxTests,
    activeWorkout: activeWorkout.length ? activeWorkout : undefined,
    exercises,
    customPlans,
    customProgramProgress,
    activeCustomWorkout: activeCustomWorkout.length ? activeCustomWorkout : undefined,
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
