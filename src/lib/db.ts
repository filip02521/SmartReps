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
  }
}

export const db = new SmartRepsDB()
