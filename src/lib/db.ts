import Dexie, { type EntityTable } from 'dexie'
import type { SetResultDraft, ProgramStatus } from './progress-engine'
import type { Program } from '@/data/plans/types'

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
  program: Program
  cycleId: string
  dayNumber: number
  cycleAttempt: number
  status: 'in_progress' | 'completed' | 'abandoned'
  startedAt: string
  completedAt?: string
  passed?: boolean
  totalReps?: number
  setResults: SetResultDraft[]
}

export type ActiveWorkoutState = {
  program: Program
  sessionId: string
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimerJson: string | null
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

class SmartRepsDB extends Dexie {
  programProgress!: EntityTable<LocalProgramProgress, 'id'>
  workoutSessions!: EntityTable<LocalWorkoutSession, 'id'>
  activeWorkout!: EntityTable<ActiveWorkoutState, 'program'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  maxTests!: EntityTable<LocalMaxTest, 'id'>

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
  }
}

export const db = new SmartRepsDB()
