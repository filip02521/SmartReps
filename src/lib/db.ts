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
  /** Optional user note attached to the session (e.g. "bolał łokieć", "zwiększyć ciężar"). */
  note?: string
}

export type ActiveWorkoutState = {
  program: Program
  sessionId: string
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimerJson: string | null
  failedRetryUsed?: boolean
  /** Display-only startedAt (shifted by pause duration on resume) for the live clock. */
  displayStartedAt?: string | null
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
  /** Display-only startedAt (shifted by pause duration on resume) for the live clock. */
  displayStartedAt?: string | null
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

export type BodyWeightEntry = {
  id: string
  weightKg: number
  measuredAt: string
  note?: string
}

export type LocalAchievementUnlockRow = {
  id: string
  unlockedAt: string
  seenAt: string | null
  tierLevel?: number | null
}

export type AiInsightType = 'post_workout' | 'weekly_report' | 'plateau_warning'

/** Cached AI workout analysis result — persisted so it survives page refresh / tab switch. */
export type AiAnalysisCache = {
  id: string
  /** Serialized AnalysisResult JSON (strengths, weaknesses, volume, suggestions). */
  resultJson: string
  createdAt: string
}

export type LocalAiInsight = {
  id: string
  type: AiInsightType
  sessionId?: string
  weekKey?: string
  program?: string
  customPlanId?: string
  title: string
  body: string
  tone: 'insight' | 'warning' | 'success'
  source: 'local' | 'ai'
  createdAt: string
  dismissedAt?: string
  readAt?: string
  /** Optional structured metrics for display (e.g. weekly report stats). */
  metricsJson?: string
}

/** Tombstone for a deleted session — prevents resurrection by cross-device sync. */
export type SessionTombstone = {
  sessionId: string
  deletedAt: string
}

/** Tombstone for a deleted custom plan — prevents resurrection by cross-device sync. */
export type CustomPlanTombstone = {
  planId: string
  deletedAt: string
}

/** Tombstone for a deleted exercise — prevents resurrection by cross-device sync. */
export type ExerciseTombstone = {
  exerciseId: string
  deletedAt: string
}

/** Tombstone for a deleted body-weight entry — prevents resurrection by cross-device sync. */
export type BodyWeightTombstone = {
  entryId: string
  deletedAt: string
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
  bodyWeight!: EntityTable<BodyWeightEntry, 'id'>
  aiInsights!: EntityTable<LocalAiInsight, 'id'>
  aiAnalysisCache!: EntityTable<AiAnalysisCache, 'id'>
  sessionTombstones!: EntityTable<SessionTombstone, 'sessionId'>
  customPlanTombstones!: EntityTable<CustomPlanTombstone, 'planId'>
  exerciseTombstones!: EntityTable<ExerciseTombstone, 'exerciseId'>
  bodyWeightTombstones!: EntityTable<BodyWeightTombstone, 'entryId'>

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

    // v6: body weight tracking
    this.version(6).stores({
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
      bodyWeight: 'id, measuredAt',
    })

    // v7: AI coach insights (post-workout, weekly reports, plateau warnings)
    this.version(7).stores({
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
      bodyWeight: 'id, measuredAt',
      aiInsights: 'id, type, sessionId, weekKey, createdAt',
    })
    // v8: Session tombstones — prevent deleted sessions from being resurrected by sync
    this.version(8).stores({
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
      bodyWeight: 'id, measuredAt',
      aiInsights: 'id, type, sessionId, weekKey, createdAt',
      sessionTombstones: 'sessionId, deletedAt',
    })
    // v9: AI analysis cache — persists workout analysis results across refresh/tab switch
    this.version(9).stores({
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
      bodyWeight: 'id, measuredAt',
      aiInsights: 'id, type, sessionId, weekKey, createdAt',
      sessionTombstones: 'sessionId, deletedAt',
      aiAnalysisCache: 'id, createdAt',
    })
    // v10: Tombstones for custom plans, exercises, and body-weight entries
    this.version(10).stores({
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
      bodyWeight: 'id, measuredAt',
      aiInsights: 'id, type, sessionId, weekKey, createdAt',
      sessionTombstones: 'sessionId, deletedAt',
      aiAnalysisCache: 'id, createdAt',
      customPlanTombstones: 'planId, deletedAt',
      exerciseTombstones: 'exerciseId, deletedAt',
      bodyWeightTombstones: 'entryId, deletedAt',
    })

    // v11: Add `source` field to exercises ('user' | 'ai') — no index change.
    // Existing exercises get source='user' by default via ExerciseDefinition optional field.
    this.version(11).stores({
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
      bodyWeight: 'id, measuredAt',
      aiInsights: 'id, type, sessionId, weekKey, createdAt',
      sessionTombstones: 'sessionId, deletedAt',
      aiAnalysisCache: 'id, createdAt',
      customPlanTombstones: 'planId, deletedAt',
      exerciseTombstones: 'exerciseId, deletedAt',
      bodyWeightTombstones: 'entryId, deletedAt',
    })
  }
}

export const db = new SmartRepsDB()
