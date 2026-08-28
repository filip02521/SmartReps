import { db } from '@/lib/db'
import { useAppStore, type UserSettings } from '@/stores/app-store'
import type {
  ActiveWorkoutState,
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

export async function exportBackupSnapshot(): Promise<BackupSnapshotV1> {
  const { settings } = useAppStore.getState()
  const [programProgress, workoutSessions, maxTests, activeWorkout] = await Promise.all([
    db.programProgress.toArray(),
    db.workoutSessions.toArray(),
    db.maxTests.toArray(),
    db.activeWorkout.toArray(),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
    programProgress,
    workoutSessions,
    maxTests,
    activeWorkout: activeWorkout.length ? activeWorkout : undefined,
  }
}

/** Alias for callers expecting buildBackupSnapshot (Phase C compat). */
export const buildBackupSnapshot = exportBackupSnapshot

export function serializeBackup(snapshot: BackupSnapshotV1): string {
  return JSON.stringify(snapshot, null, 2)
}

export function downloadBackupJson(snapshot: BackupSnapshotV1, filename?: string) {
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
