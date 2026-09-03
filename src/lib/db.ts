import Dexie, { type EntityTable } from 'dexie'
import type { SetResultDraft, ProgramStatus } from './progress-engine'
import type { Program } from '@/data/plans/types'
import type {
  CustomPlan,
  CustomProgramProgress,
  ExerciseDefinition,
  ExerciseLog,
} from '@/lib/exercise-model'

export type LocalProgramProgress = {
  id?: number
  program: Program
  cycleId: string
  currentDay: number
  status: ProgramStatus
  cycleAttempt: number
  lastWorkoutAt: string | null
  nextWorkoutAfter: string | null
  updatedAt: string
}

export type LocalWorkoutSession = {
  id: string
  program: Program | 'custom'
  programKind?: 'builtin' | 'custom'
  customPlanId?: string
  cycleId: string
  dayNumber: number
  cycleAttempt: number
  status: 'in_progress' | 'completed' | 'abandoned'
  startedAt: string
  completedAt?: string
  passed?: boolean
  totalReps?: number
  setResults: SetResultDraft[]
  /** Multi-exercise logs for custom sessions. */
  exerciseLogs?: ExerciseLog[]
  /** JSON snapshot of progression diff after cycle complete (see custom-progression). */
  progressionDiffJson?: string
  /** Session PlanDay snapshot when sets/rest were edited mid-workout (offer save on summary). */
  sessionDayPatchJson?: string | null
}

export type ActiveWorkoutState = {
  program: Program
  sessionId: string
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimerJson: string | null
  failedRetryUsed?: boolean
  updatedAt: string
}

export type ActiveCustomWorkoutState = {
  customPlanId: string
  sessionId: string
  currentExerciseIndex: number
  currentSetIndex: number
  exerciseLogs: ExerciseLog[]
  restTimerJson: string | null
  /** AMRAP block end timestamp (ms since epoch), persisted for resume. */
  amrapEndAt?: number | null
  amrapGroupId?: string | null
  /** Session-only PlanDay JSON (e.g. extra sets) — not written to custom_plans until summary confirm. */
  dayOverrideJson?: string | null
  updatedAt: string
}

export type SyncQueueItem = {
  id?: number
  table: string
  action: 'insert' | 'update' | 'delete'
  payload: string
  createdAt: string
  attempts?: number
}

export type LocalMaxTest = {
  id?: number
  program: Program
  reps: number
  testedAt: string
  selectedCycleId: string
  wasManualOverride: boolean
}

export type LocalExercise = ExerciseDefinition
export type LocalCustomPlan = CustomPlan
export type LocalCustomProgramProgress = CustomProgramProgress

export type LocalAchievementUnlockRow = {
  id: string
  unlockedAt: string
  seenAt: string | null
}

class SmartRepsDB extends Dexie {
  programProgress!: EntityTable<LocalProgramProgress, 'id'>
  workoutSessions!: EntityTable<LocalWorkoutSession, 'id'>
  activeWorkout!: EntityTable<ActiveWorkoutState, 'program'>
  activeCustomWorkout!: EntityTable<ActiveCustomWorkoutState, 'customPlanId'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  maxTests!: EntityTable<LocalMaxTest, 'id'>
  exercises!: EntityTable<LocalExercise, 'id'>
  customPlans!: EntityTable<LocalCustomPlan, 'id'>
  customProgramProgress!: EntityTable<LocalCustomProgramProgress, 'id'>
  achievementUnlocks!: EntityTable<LocalAchievementUnlockRow, 'id'>

  constructor() {
    super('SmartRepsDB')
    this.version(1).stores({
      programProgress: '++id, program',
      workoutSessions: 'id, program, startedAt',
      activeWorkout: 'program',
      syncQueue: '++id, createdAt',
      maxTests: '++id, program, testedAt',
    })
    // v2: unique program; session status queries (compound maxTests unique in v3)
    this.version(2).stores({
      programProgress: '++id, &program',
      workoutSessions: 'id, program, startedAt, [program+status]',
      activeWorkout: 'program',
      syncQueue: '++id, createdAt',
      maxTests: '++id, program, testedAt, [program+testedAt]',
    })
    this.version(3)
      .stores({
        programProgress: '++id, &program',
        workoutSessions: 'id, program, startedAt, [program+status]',
        activeWorkout: 'program',
        syncQueue: '++id, createdAt',
        maxTests: '++id, program, testedAt, &[program+testedAt]',
      })
      .upgrade(async (tx) => {
        const progress = await tx.table('programProgress').toArray()
        const seenProg = new Set<string>()
        const sortedProg = [...progress].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        for (const row of sortedProg) {
          if (seenProg.has(row.program)) {
            if (row.id != null) await tx.table('programProgress').delete(row.id)
          } else {
            seenProg.add(row.program)
          }
        }

        const tests = await tx.table('maxTests').toArray()
        const seenTest = new Set<string>()
        for (const row of tests) {
          const key = `${row.program}|${row.testedAt}`
          if (seenTest.has(key)) {
            if (row.id != null) await tx.table('maxTests').delete(row.id)
          } else {
            seenTest.add(key)
          }
        }
      })

    // v4: custom exercises & plans
    this.version(4).stores({
      programProgress: '++id, &program',
      workoutSessions: 'id, program, startedAt, [program+status], customPlanId',
      activeWorkout: 'program',
      activeCustomWorkout: 'customPlanId',
      syncQueue: '++id, createdAt',
      maxTests: '++id, program, testedAt, &[program+testedAt]',
      exercises: 'id, updatedAt, archived',
      customPlans: 'id, status, updatedAt',
      customProgramProgress: '++id, &customPlanId, updatedAt',
    })

    // v5: achievement unlocks (offline-first badges)
    this.version(5).stores({
      programProgress: '++id, &program',
      workoutSessions: 'id, program, startedAt, [program+status], customPlanId',
      activeWorkout: 'program',
      activeCustomWorkout: 'customPlanId',
      syncQueue: '++id, createdAt',
      maxTests: '++id, program, testedAt, &[program+testedAt]',
      exercises: 'id, updatedAt, archived',
      customPlans: 'id, status, updatedAt',
      customProgramProgress: '++id, &customPlanId, updatedAt',
      achievementUnlocks: 'id, unlockedAt',
    })
  }
}

export const db = new SmartRepsDB()
