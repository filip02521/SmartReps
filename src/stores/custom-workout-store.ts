import { create } from 'zustand'
import type { ExerciseLog, SetLog } from '@/lib/exercise-model'
import type { RestTimerState } from '@/lib/rest-timer'

type CustomWorkoutStore = {
  sessionId: string | null
  customPlanId: string | null
  dayNumber: number
  cycleAttempt: number
  currentExerciseIndex: number
  currentSetIndex: number
  exerciseLogs: ExerciseLog[]
  restTimer: RestTimerState | null
  failedRetryUsed: boolean
  immersive: boolean

  startSession: (params: {
    sessionId: string
    customPlanId: string
    dayNumber: number
    cycleAttempt: number
    exerciseCount: number
  }) => void
  resumeSession: (params: {
    sessionId: string
    customPlanId: string
    dayNumber: number
    cycleAttempt: number
    currentExerciseIndex: number
    currentSetIndex: number
    exerciseLogs: ExerciseLog[]
    restTimer: RestTimerState | null
  }) => void
  completeSet: (exerciseId: string, order: number, result: SetLog) => void
  undoLastSet: () => SetLog | null
  setRestTimer: (timer: RestTimerState | null) => void
  setPointers: (exerciseIndex: number, setIndex: number) => void
  setFailedRetryUsed: (v: boolean) => void
  setImmersive: (v: boolean) => void
  reset: () => void
}

const initialState = {
  sessionId: null as string | null,
  customPlanId: null as string | null,
  dayNumber: 1,
  cycleAttempt: 1,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  exerciseLogs: [] as ExerciseLog[],
  restTimer: null as RestTimerState | null,
  failedRetryUsed: false,
  immersive: false,
}

export const useCustomWorkoutStore = create<CustomWorkoutStore>((set, get) => ({
  ...initialState,

  startSession: ({ sessionId, customPlanId, dayNumber, cycleAttempt, exerciseCount }) =>
    set({
      ...initialState,
      sessionId,
      customPlanId,
      dayNumber,
      cycleAttempt,
      exerciseLogs: Array.from({ length: exerciseCount }, (_, i) => ({
        exerciseId: '',
        order: i,
        sets: [],
      })),
      immersive: true,
    }),

  resumeSession: (params) =>
    set({
      ...initialState,
      ...params,
      immersive: true,
    }),

  completeSet: (exerciseId, order, result) => {
    const { exerciseLogs, currentExerciseIndex, currentSetIndex } = get()
    const logs = [...exerciseLogs]
    const existing = logs[currentExerciseIndex]
    const log: ExerciseLog = existing?.sets.length
      ? {
          ...existing,
          exerciseId,
          order,
          sets: [...existing.sets, result],
        }
      : { exerciseId, order, sets: [result] }
    logs[currentExerciseIndex] = log
    set({
      exerciseLogs: logs,
      currentSetIndex: currentSetIndex + 1,
      failedRetryUsed: false,
      restTimer: null,
    })
  },

  undoLastSet: () => {
    const { exerciseLogs, currentExerciseIndex, currentSetIndex } = get()
    const log = exerciseLogs[currentExerciseIndex]
    if (!log?.sets.length) return null
    const removed = log.sets[log.sets.length - 1]!
    const nextLogs = [...exerciseLogs]
    nextLogs[currentExerciseIndex] = { ...log, sets: log.sets.slice(0, -1) }
    set({
      exerciseLogs: nextLogs,
      currentSetIndex: Math.max(0, currentSetIndex - 1),
      restTimer: null,
      failedRetryUsed: false,
    })
    return removed
  },

  setRestTimer: (timer) => set({ restTimer: timer }),
  setPointers: (exerciseIndex, setIndex) =>
    set({ currentExerciseIndex: exerciseIndex, currentSetIndex: setIndex, failedRetryUsed: false }),
  setFailedRetryUsed: (v) => set({ failedRetryUsed: v }),
  setImmersive: (v) => set({ immersive: v }),
  reset: () => set(initialState),
}))
