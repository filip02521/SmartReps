/**
 * Regression: finalizeCustomDay must not resurrect an ABANDONED custom
 * session (cancel / start-fresh on another tab or device) — the old code
 * treated every non-'completed' status as writable and overwrote
 * 'abandoned' with 'completed', advancing custom progress against the
 * user's explicit discard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import type { CustomPlan, CustomProgramProgress, ExerciseLog } from '@/lib/exercise-model'

const mocks = vi.hoisted(() => {
  const sessionRows: LocalWorkoutSession[] = []
  const progressRows: CustomProgramProgress[] = []
  return {
    sessionRows,
    progressRows,
    enqueueSync: vi.fn().mockResolvedValue(undefined),
    putProgress: vi.fn(async (row: CustomProgramProgress) => {
      const i = progressRows.findIndex((r) => r.customPlanId === row.customPlanId)
      if (i >= 0) progressRows[i] = row
      else progressRows.push(row)
    }),
  }
})
const { sessionRows, progressRows, enqueueSync, putProgress } = mocks

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: (field: keyof LocalWorkoutSession) => ({
        equals: (value: unknown) => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () =>
              mocks.sessionRows.filter((s) => s[field] === value && fn(s)),
            count: async () =>
              mocks.sessionRows.filter((s) => s[field] === value && fn(s)).length,
          }),
          toArray: async () => mocks.sessionRows.filter((s) => s[field] === value),
        }),
      }),
      get: async (id: string) => mocks.sessionRows.find((s) => s.id === id),
      put: async (row: LocalWorkoutSession) => {
        const i = mocks.sessionRows.findIndex((s) => s.id === row.id)
        if (i >= 0) mocks.sessionRows[i] = row
        else mocks.sessionRows.push(row)
      },
    },
    activeCustomWorkout: {
      get: vi.fn(async () => undefined),
      put: vi.fn(),
      delete: vi.fn(),
    },
    customProgramProgress: {
      put: mocks.putProgress,
      add: vi.fn(async () => 1),
    },
    transaction: async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
  },
}))

vi.mock('@/lib/custom-plan-service', () => ({
  getOrCreateCustomProgress: vi.fn(async (planId: string) => ({
    id: 1,
    customPlanId: planId,
    currentDay: 1,
    status: 'active',
    cycleAttempt: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  applyCycleProgression: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/custom-progression', () => ({
  previewProgressionDiff: vi.fn(() => []),
}))
vi.mock('@/lib/custom-previous-result', () => ({
  pickPreviousCustomSet: vi.fn(() => undefined),
  toPreviousCustomSetResult: vi.fn(),
}))
vi.mock('@/lib/sync', () => ({
  enqueueSync: mocks.enqueueSync,
  enqueueActiveCustomWorkoutSync: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/auth-sync', () => ({ runAuthenticatedSync: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/achievements/schedule', () => ({ scheduleAchievementCheck: vi.fn() }))
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvents: {
    firstWorkoutDone: 'first_workout_done',
    dayCompleted: 'day_completed',
    communityTrained: 'community_trained',
    communityImportTrained48h: 'community_import_trained_48h',
    communityImportError: 'community_import_error',
  },
  trackSyncError: vi.fn(),
}))
vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ hasCompletedFirstWorkout: true })),
  }),
}))

import { finalizeCustomDay } from '@/lib/custom-session-service'

const plan = {
  id: 'plan-1',
  name: 'Plan',
  days: [
    { dayNumber: 1, restAfterDay: 1, exercises: [] },
    { dayNumber: 2, restAfterDay: 1, exercises: [] },
  ],
  progression: { enabled: false },
  createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as CustomPlan

const logs: ExerciseLog[] = [
  {
    exerciseId: 'ex-1',
    order: 0,
    sets: [
      {
        setNumber: 1,
        passed: true,
        actual: { reps: 8 },
        prescription: { reps: { kind: 'fixed', value: 8 } },
      },
    ],
  },
]

function session(overrides: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 'csess-1',
    program: 'custom',
    programKind: 'custom',
    customPlanId: 'plan-1',
    cycleId: 'plan-1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: '2026-01-10T10:00:00.000Z',
    setResults: [],
    exerciseLogs: [],
    ...overrides,
  }
}

beforeEach(() => {
  sessionRows.length = 0
  progressRows.length = 0
  vi.clearAllMocks()
})

describe('finalizeCustomDay', () => {
  it('does not resurrect an abandoned session nor advance custom progress', async () => {
    sessionRows.push(session({ status: 'abandoned', completedAt: '2026-01-10T10:30:00.000Z' }))
    const res = await finalizeCustomDay({ session: sessionRows[0]!, plan, exerciseLogs: logs })
    expect(res.passed).toBe(false)
    expect(sessionRows[0]!.status).toBe('abandoned')
    expect(putProgress).not.toHaveBeenCalled()
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('completes an in_progress session and advances to the next day', async () => {
    const s = session({ id: 'csess-2' })
    sessionRows.push(s)
    const res = await finalizeCustomDay({ session: s, plan, exerciseLogs: logs })
    expect(res.passed).toBe(true)
    expect(sessionRows[0]!.status).toBe('completed')
    expect(sessionRows[0]!.totalReps).toBe(8)
    expect(putProgress).toHaveBeenCalledWith(
      expect.objectContaining({ currentDay: 2, status: 'rest' }),
    )
  })
})
