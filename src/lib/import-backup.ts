import { db } from '@/lib/db'
import { useAppStore, defaultSettings, type UserSettings } from '@/stores/app-store'
import { enqueueSync } from '@/lib/sync'
import { getVapidPublicKey } from '@/lib/web-push'
import type {
  LocalWorkoutSession,
} from '@/lib/db'
import type { SetTarget } from '@/data/plans/types'
import type { BackupSnapshot, BackupSnapshotV1, BackupSnapshotV2 } from '@/lib/export-backup'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export type CsvImportPreview = {
  kind: 'csv'
  totalRows: number
  newSessions: number
  duplicateSessions: number
  invalidRows: number
  sessions: LocalWorkoutSession[]
}

export type JsonImportPreview = {
  kind: 'json'
  exportedAt: string
  newSessions: number
  duplicateSessions: number
  progressUpdates: number
  progressConflicts: number
  newTests: number
  duplicateTests: number
  activeWorkoutCount: number
  activeCustomWorkoutCount: number
  customPlanCount: number
  exerciseCount: number
  customProgressCount: number
  skipActiveWorkout: boolean
  snapshot: BackupSnapshotV2
}

export type ImportPreview = CsvImportPreview | JsonImportPreview

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseSets(raw: string): LocalWorkoutSession['setResults'] {
  const inner = raw.replace(/^"|"$/g, '')
  if (!inner) return []
  return inner.split('|').map((part) => {
    const m = part.match(/^S(\d+):(\d+)$/)
    if (!m) throw new Error('invalid sets')
    const reps = Number(m[2])
    const target: SetTarget = { kind: 'fixed', reps }
    return {
      setNumber: Number(m[1]),
      target,
      actual: reps,
      passed: true,
    }
  })
}

export function parseSessionsCsv(text: string): LocalWorkoutSession[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const header = 'data,session_id,program,cycle_id,day,attempt,status,passed,total_reps,sets'
  const sessions: LocalWorkoutSession[] = []
  for (const line of lines) {
    if (line === header || line.startsWith('data,session_id,')) continue
    const cols = parseCsvLine(line)
    if (cols.length < 10) continue
    const [date, id, program, cycleId, day, attempt, status, passed, totalReps, setsRaw] = cols
    if (program !== 'pushups' && program !== 'pullups') continue
    if (status !== 'completed' && status !== 'in_progress' && status !== 'abandoned') continue
    sessions.push({
      id,
      program,
      cycleId,
      dayNumber: Number(day),
      cycleAttempt: Number(attempt),
      status,
      startedAt: `${date}T12:00:00.000Z`,
      passed: passed === 'true' ? true : passed === 'false' ? false : undefined,
      totalReps: totalReps ? Number(totalReps) : undefined,
      setResults: parseSets(setsRaw),
    })
  }
  return sessions
}

export function isBackupSnapshotV1(value: unknown): value is BackupSnapshotV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as BackupSnapshotV1
  return v.version === 1 && typeof v.exportedAt === 'string' && Array.isArray(v.workoutSessions)
}

export function isBackupSnapshotV2(value: unknown): value is BackupSnapshotV2 {
  if (!value || typeof value !== 'object') return false
  const v = value as BackupSnapshotV2
  return (
    v.version === 2 &&
    typeof v.exportedAt === 'string' &&
    Array.isArray(v.workoutSessions) &&
    Array.isArray(v.exercises) &&
    Array.isArray(v.customPlans) &&
    Array.isArray(v.customProgramProgress)
  )
}

export function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  return isBackupSnapshotV1(value) || isBackupSnapshotV2(value)
}

function normalizeBackup(snapshot: BackupSnapshot): BackupSnapshotV2 {
  if (snapshot.version === 2) return snapshot
  return {
    ...snapshot,
    version: 2,
    exercises: [],
    customPlans: [],
    customProgramProgress: [],
  }
}

export async function previewCsvImport(text: string): Promise<CsvImportPreview> {
  const parsed = parseSessionsCsv(text)
  const existingIds = new Set((await db.workoutSessions.toArray()).map((s) => s.id))
  let newSessions = 0
  let duplicateSessions = 0
  const sessions: LocalWorkoutSession[] = []
  for (const s of parsed) {
    if (existingIds.has(s.id)) {
      duplicateSessions++
    } else {
      newSessions++
      sessions.push(s)
    }
  }
  return {
    kind: 'csv',
    totalRows: parsed.length,
    newSessions,
    duplicateSessions,
    invalidRows: 0,
    sessions,
  }
}

export async function previewJsonImport(text: string): Promise<JsonImportPreview> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('invalid_json')
  }
  if (!isBackupSnapshot(parsed)) throw new Error('invalid_schema')
  const snapshot = normalizeBackup(parsed)

  const existingSessionIds = new Set((await db.workoutSessions.toArray()).map((s) => s.id))
  const existingProgress = await db.programProgress.toArray()
  const progressByProgram = new Map(existingProgress.map((p) => [p.program, p]))
  const existingTests = new Set(
    (await db.maxTests.toArray()).map((t) => `${t.program}|${t.testedAt}`),
  )
  const localActiveBuiltin = await db.activeWorkout.count()
  const localActiveCustom = await db.activeCustomWorkout.count()

  let newSessions = 0
  let duplicateSessions = 0
  let progressUpdates = 0
  let progressConflicts = 0
  let newTests = 0
  let duplicateTests = 0

  for (const s of snapshot.workoutSessions) {
    if (existingSessionIds.has(s.id)) duplicateSessions++
    else newSessions++
  }

  for (const p of snapshot.programProgress) {
    const local = progressByProgram.get(p.program)
    if (!local) progressUpdates++
    else if (new Date(p.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
      progressUpdates++
      progressConflicts++
    }
  }

  for (const t of snapshot.maxTests) {
    const key = `${t.program}|${t.testedAt}`
    if (existingTests.has(key)) duplicateTests++
    else newTests++
  }

  return {
    kind: 'json',
    exportedAt: snapshot.exportedAt,
    newSessions,
    duplicateSessions,
    progressUpdates,
    progressConflicts,
    newTests,
    duplicateTests,
    activeWorkoutCount:
      (snapshot.activeWorkout?.length ?? 0) + (snapshot.activeCustomWorkout?.length ?? 0),
    activeCustomWorkoutCount: snapshot.activeCustomWorkout?.length ?? 0,
    customPlanCount: snapshot.customPlans.length,
    exerciseCount: snapshot.exercises.length,
    customProgressCount: snapshot.customProgramProgress.length,
    skipActiveWorkout: localActiveBuiltin > 0 || localActiveCustom > 0,
    snapshot,
  }
}

export function assertImportFileSize(bytes: number) {
  if (bytes > MAX_FILE_BYTES) throw new Error('file_too_large')
}

function mergeSettings(imported: UserSettings): Partial<UserSettings> {
  const patch: Partial<UserSettings> = { ...imported }
  if (!getVapidPublicKey()) {
    patch.pushNotifications = false
  }
  return patch
}

export async function applyCsvImport(
  preview: CsvImportPreview,
  mode: 'skip' | 'replace',
): Promise<{ written: number }> {
  let written = 0
  for (const s of preview.sessions) {
    if (mode === 'replace') {
      await db.workoutSessions.put(s)
    } else {
      const exists = await db.workoutSessions.get(s.id)
      if (exists) continue
      await db.workoutSessions.add(s)
    }
    await enqueueSync('workout_sessions', mode === 'replace' ? 'update' : 'insert', s)
    written++
  }
  return { written }
}

export async function applyJsonImport(
  preview: JsonImportPreview,
  opts: {
    sessionMode: 'skip' | 'replace'
    mergeProgress: boolean
    importActiveWorkout: boolean
    mergeSettings: boolean
  },
): Promise<void> {
  const { snapshot } = preview

  for (const s of snapshot.workoutSessions) {
    const exists = await db.workoutSessions.get(s.id)
    if (exists && opts.sessionMode === 'skip') continue
    await db.workoutSessions.put(s)
    await enqueueSync('workout_sessions', exists ? 'update' : 'insert', s)
  }

  if (opts.mergeProgress) {
    for (const p of snapshot.programProgress) {
      const local = await db.programProgress.where('program').equals(p.program).first()
      if (local && new Date(local.updatedAt).getTime() >= new Date(p.updatedAt).getTime()) {
        continue
      }
      if (local?.id != null) {
        await db.programProgress.put({ ...p, id: local.id })
      } else {
        await db.programProgress.put(p)
      }
      await enqueueSync('program_progress', 'update', p)
    }
  }

  for (const t of snapshot.maxTests) {
    const dup = await db.maxTests
      .where('[program+testedAt]')
      .equals([t.program, t.testedAt])
      .first()
    if (dup) continue
    const id = await db.maxTests.add(t)
    await enqueueSync('max_tests', 'insert', { ...t, id })
  }

  if (opts.importActiveWorkout && snapshot.activeWorkout?.length) {
    for (const a of snapshot.activeWorkout) {
      await db.activeWorkout.put(a)
      await enqueueSync('active_workout', 'update', a)
    }
  }

  for (const ex of snapshot.exercises) {
    const local = await db.exercises.get(ex.id)
    if (local && new Date(local.updatedAt).getTime() >= new Date(ex.updatedAt).getTime()) {
      continue
    }
    await db.exercises.put(ex)
    await enqueueSync('user_exercises', local ? 'update' : 'insert', ex)
  }

  for (const plan of snapshot.customPlans) {
    const local = await db.customPlans.get(plan.id)
    if (local && new Date(local.updatedAt).getTime() >= new Date(plan.updatedAt).getTime()) {
      continue
    }
    await db.customPlans.put(plan)
    await enqueueSync('custom_plans', local ? 'update' : 'insert', plan)
  }

  if (opts.mergeProgress) {
    for (const p of snapshot.customProgramProgress) {
      const local = await db.customProgramProgress
        .where('customPlanId')
        .equals(p.customPlanId)
        .first()
      if (local && new Date(local.updatedAt).getTime() >= new Date(p.updatedAt).getTime()) {
        continue
      }
      let row: import('@/lib/exercise-model').CustomProgramProgress
      if (local?.id != null) {
        row = { ...p, id: local.id }
        await db.customProgramProgress.put(row)
      } else {
        const id = await db.customProgramProgress.add(p)
        row = { ...p, id }
      }
      await enqueueSync('custom_program_progress', 'update', row)
    }
  }

  if (opts.importActiveWorkout && snapshot.activeCustomWorkout?.length) {
    for (const a of snapshot.activeCustomWorkout) {
      await db.activeCustomWorkout.put(a)
      const { enqueueActiveCustomWorkoutSync } = await import('@/lib/sync')
      await enqueueActiveCustomWorkoutSync(a.customPlanId, a)
    }
  }

  if (opts.mergeSettings) {
    useAppStore.getState().setSettings({
      ...defaultSettings,
      ...mergeSettings(snapshot.settings),
      onboardingComplete: snapshot.settings.onboardingComplete ?? true,
    })
  }
}

export async function readImportFile(file: File): Promise<string> {
  assertImportFileSize(file.size)
  return file.text()
}
