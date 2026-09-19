/** Tests for the ad-hoc ("empty") free workout session lifecycle. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog } from '@/lib/exercise-model'

const mocks = vi.hoisted(() => {
  const sessionRows: LocalWorkoutSession[] = []
  let idSeq = 0
  return {
    sessionRows,
    enqueueSync: vi.fn().mockResolvedValue(undefined),
    generateId: vi.fn(() => `gen-${++idSeq}`),
    resetIds: () => {
      idSeq = 0
    },
  }
})
const { sessionRows, enqueueSync } = mocks

vi.mock('@/lib/db', () => ({
  generateId: mocks.generateId,
  db: {
    transaction: async (_mode: string, _tables: unknown, fn: () => Promise<unknown>) => fn(),
    workoutSessions: {
      toArray: async () => [...mocks.sessionRows],
      where: (field: keyof LocalWorkoutSession) => ({
        equals: (value: unknown) => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () =>
              mocks.sessionRows.filter((s) => s[field] === value && fn(s)),
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
  },
}))

vi.mock('@/lib/sync', () => ({ enqueueSync: mocks.enqueueSync }))

import {
  abandonFreeWorkoutSession,
  buildPlanFromFreeWorkout,
  computeLastActualsByExercise,
  finishFreeWorkoutSession,
  freeSessionHasProgress,
  freeWorkoutSetCount,
  freeWorkoutTotalReps,
  freeWorkoutVolumeKg,
  getActiveFreeWorkoutSession,
  getPreviousFreeWorkoutSession,
  isFreeWorkoutSession,
  makeFreeSetLog,
  persistFreeWorkoutSession,
  startFreeWorkoutSession,
} from '@/lib/free-workout-service'

function session(overrides: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 'free-1',
    program: 'custom',
    programKind: 'custom',
    cycleId: 'free',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: '2026-02-10T10:00:00.000Z',
    setResults: [],
    exerciseLogs: [],
    ...overrides,
  }
}

function logs(setsPerExercise: number[]): ExerciseLog[] {
  return setsPerExercise.map((count, i) => ({
    exerciseId: `ex-${i}`,
    order: i,
    sets: Array.from({ length: count }, (_, j) =>
      makeFreeSetLog(j + 1, { reps: 10, weightKg: 60 }, 'reps_weight'),
    ),
  }))
}

const DEFS: Map<string, ExerciseDefinition> = new Map([
  [
    'ex-0',
    {
      id: 'ex-0',
      name: 'Bench Press',
      primaryMetric: 'reps_weight',
      restDefaultSec: 120,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  [
    'ex-1',
    {
      id: 'ex-1',
      name: 'Plank',
      primaryMetric: 'duration_sec',
      restDefaultSec: 60,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
])

beforeEach(() => {
  sessionRows.length = 0
  vi.clearAllMocks()
})

describe('isFreeWorkoutSession', () => {
  it('identifies ad-hoc sessions: custom program without a plan', () => {
    expect(isFreeWorkoutSession(session())).toBe(true)
    expect(isFreeWorkoutSession(session({ customPlanId: 'plan-1' }))).toBe(false)
    expect(
      isFreeWorkoutSession(session({ program: 'pushups', programKind: 'builtin' })),
    ).toBe(false)
  })
})

describe('startFreeWorkoutSession', () => {
  it('creates an in_progress custom session with no plan and a running clock', async () => {
    const s = await startFreeWorkoutSession()
    expect(s.status).toBe('in_progress')
    expect(s.program).toBe('custom')
    expect(s.customPlanId).toBeUndefined()
    expect(s.cycleId).toBe('free')
    expect(sessionRows).toHaveLength(1)
    expect(enqueueSync).toHaveBeenCalledWith('workout_sessions', 'insert', s)
  })

  it('resumes an existing active session instead of creating a duplicate', async () => {
    const existing = session({ id: 'live-1' })
    sessionRows.push(existing)
    const s = await startFreeWorkoutSession()
    expect(s.id).toBe('live-1')
    expect(sessionRows).toHaveLength(1)
  })

  it('sweeps stale (>24h) duplicate in_progress sessions, keeping the newest', async () => {
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    sessionRows.push(
      session({ id: 'old', startedAt: dayAgo }),
      session({ id: 'new', startedAt: hourAgo }),
    )
    const active = await getActiveFreeWorkoutSession()
    expect(active?.id).toBe('new')
    expect(sessionRows.find((s) => s.id === 'old')?.status).toBe('abandoned')
  })

  it('keeps fresh duplicate sessions — may be a live workout on another device', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    sessionRows.push(
      session({ id: 'older-but-fresh', startedAt: twoHoursAgo }),
      session({ id: 'new', startedAt: hourAgo }),
    )
    const active = await getActiveFreeWorkoutSession()
    expect(active?.id).toBe('new')
    // NOT abandoned — remote kill would silently stop the other device's persistence
    expect(sessionRows.find((s) => s.id === 'older-but-fresh')?.status).toBe('in_progress')
  })

  it('prefers the session with structure over a newer empty one (cross-device)', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()
    sessionRows.push(
      // device A's real workout — older but has exercises logged
      session({ id: 'with-data', startedAt: hourAgo, exerciseLogs: logs([2]) }),
      // device B's fresh empty session — newer but bare
      session({ id: 'empty', startedAt: now }),
    )
    const active = await getActiveFreeWorkoutSession()
    expect(active?.id).toBe('with-data')
  })

  it('does not touch plan-bound in_progress custom sessions', async () => {
    sessionRows.push(session({ id: 'planned', customPlanId: 'plan-9' }))
    const active = await getActiveFreeWorkoutSession()
    expect(active).toBeNull()
    expect(sessionRows[0]?.status).toBe('in_progress')
  })
})

describe('persistFreeWorkoutSession', () => {
  it('writes in_progress mutations and queues sync', async () => {
    const s = session()
    sessionRows.push(s)
    const updated = { ...s, exerciseLogs: logs([2]) }
    await persistFreeWorkoutSession(updated)
    expect(sessionRows[0]?.exerciseLogs?.[0]?.sets).toHaveLength(2)
    expect(enqueueSync).toHaveBeenCalledWith('workout_sessions', 'update', updated)
  })

  it('never resurrects a terminal session via a late write — and reports it', async () => {
    sessionRows.push(session({ status: 'abandoned', completedAt: '2026-02-10T11:00:00.000Z' }))
    const refused = await persistFreeWorkoutSession(session({ exerciseLogs: logs([3]) }))
    expect(refused).toBe('abandoned')
    expect(sessionRows[0]?.status).toBe('abandoned')
    expect(sessionRows[0]?.exerciseLogs).toHaveLength(0)
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('returns the stored terminal status so the UI can follow the data', async () => {
    sessionRows.push(session({ status: 'completed', completedAt: '2026-02-10T11:00:00.000Z' }))
    expect(await persistFreeWorkoutSession(session())).toBe('completed')
    expect(enqueueSync).not.toHaveBeenCalled()
  })
})

describe('finishFreeWorkoutSession', () => {
  it('marks the session completed with totals', async () => {
    const s = session()
    sessionRows.push(s)
    const done = await finishFreeWorkoutSession({ ...s, exerciseLogs: logs([2, 1]) })
    expect(done?.status).toBe('completed')
    expect(done?.passed).toBe(true)
    expect(done?.totalReps).toBe(30)
    expect(done?.completedAt).toBeTruthy()
  })

  it('is a no-op on an abandoned session', async () => {
    sessionRows.push(session({ status: 'abandoned' }))
    const done = await finishFreeWorkoutSession(session({ exerciseLogs: logs([1]) }))
    expect(done).toBeNull()
    expect(sessionRows[0]?.status).toBe('abandoned')
  })

  it('is idempotent — a second finish returns the completed session', async () => {
    const s = session({ status: 'completed', completedAt: '2026-02-10T11:00:00.000Z', totalReps: 30 })
    sessionRows.push(s)
    const done = await finishFreeWorkoutSession(s)
    expect(done?.status).toBe('completed')
    expect(done?.totalReps).toBe(30)
    // no second write / no sync churn
    expect(enqueueSync).not.toHaveBeenCalled()
  })
})

describe('abandonFreeWorkoutSession', () => {
  it('marks abandoned and propagates to sync (no cloud zombie)', async () => {
    sessionRows.push(session())
    await abandonFreeWorkoutSession('free-1')
    const s = sessionRows[0]
    expect(s?.status).toBe('abandoned')
    expect(s?.completedAt).toBeTruthy()
    expect(enqueueSync).toHaveBeenCalledWith('workout_sessions', 'update', s)
  })

  it('refuses to abandon a completed session or a plan-bound session', async () => {
    sessionRows.push(
      session({ id: 'done', status: 'completed' }),
      session({ id: 'planned', customPlanId: 'plan-1' }),
    )
    await abandonFreeWorkoutSession('done')
    await abandonFreeWorkoutSession('planned')
    expect(sessionRows.map((s) => s.status)).toEqual(['completed', 'in_progress'])
    expect(enqueueSync).not.toHaveBeenCalled()
  })
})

describe('getPreviousFreeWorkoutSession', () => {
  it('returns the latest completed free session BEFORE the current one', async () => {
    sessionRows.push(
      session({ id: 'old', status: 'completed', startedAt: '2026-02-01T10:00:00.000Z', completedAt: '2026-02-01T11:00:00.000Z' }),
      session({ id: 'prev', status: 'completed', startedAt: '2026-02-08T10:00:00.000Z', completedAt: '2026-02-08T11:00:00.000Z' }),
      session({ id: 'newer', status: 'completed', startedAt: '2026-02-12T10:00:00.000Z', completedAt: '2026-02-12T11:00:00.000Z' }),
      // plan-bound sessions never qualify
      session({ id: 'planned', customPlanId: 'p', status: 'completed', startedAt: '2026-02-09T10:00:00.000Z', completedAt: '2026-02-09T11:00:00.000Z' }),
    )
    const current = session({ id: 'cur', status: 'completed', startedAt: '2026-02-10T10:00:00.000Z', completedAt: '2026-02-10T11:00:00.000Z' })
    const prev = await getPreviousFreeWorkoutSession(current)
    expect(prev?.id).toBe('prev')
  })
})

describe('makeFreeSetLog', () => {
  it('mirrors the actual as the prescription for each metric', () => {
    expect(makeFreeSetLog(1, { reps: 12 }, 'reps')).toEqual({
      setNumber: 1,
      actual: { reps: 12 },
      passed: true,
      prescription: { reps: { kind: 'fixed', value: 12 } },
    })
    const rw = makeFreeSetLog(2, { reps: 8, weightKg: 80 }, 'reps_weight')
    expect(rw.prescription.weightKg).toEqual({ kind: 'fixed', value: 80 })
    const d = makeFreeSetLog(1, { durationSec: 45 }, 'duration_sec')
    expect(d.prescription.durationSec).toEqual({ kind: 'fixed', value: 45 })
  })
})

describe('computeLastActualsByExercise', () => {
  it('seeds each exercise from its most recent logged set', async () => {
    sessionRows.push(
      session({
        id: 'older',
        status: 'completed',
        startedAt: '2026-02-01T10:00:00.000Z',
        completedAt: '2026-02-01T11:00:00.000Z',
        exerciseLogs: [{ exerciseId: 'ex-a', order: 0, sets: [makeFreeSetLog(1, { reps: 8 }, 'reps')] }],
      }),
      session({
        id: 'newer',
        status: 'completed',
        startedAt: '2026-02-09T10:00:00.000Z',
        completedAt: '2026-02-09T11:00:00.000Z',
        exerciseLogs: [{ exerciseId: 'ex-a', order: 0, sets: [makeFreeSetLog(1, { reps: 12 }, 'reps')] }],
      }),
    )
    const map = await computeLastActualsByExercise()
    expect(map.get('ex-a')).toEqual({ reps: 12 })
  })
})

describe('totals', () => {
  it('counts sets, reps, and weighted volume across exercises', () => {
    const l = logs([2, 1])
    expect(freeWorkoutSetCount(l)).toBe(3)
    expect(freeWorkoutTotalReps(l)).toBe(30)
    expect(freeWorkoutVolumeKg(l)).toBe(1800)
    expect(freeSessionHasProgress(l)).toBe(true)
    expect(freeSessionHasProgress(logs([0, 0]))).toBe(false)
  })
})

describe('buildPlanFromFreeWorkout', () => {
  it('converts performed logs into an active single-day plan', () => {
    const s = session({
      exerciseLogs: [
        { exerciseId: 'ex-0', order: 0, sets: logs([2])[0].sets },
        { exerciseId: 'ex-empty', order: 1, sets: [] }, // skipped: no sets done
        {
          exerciseId: 'ex-1',
          order: 2,
          sets: [makeFreeSetLog(1, { durationSec: 45 }, 'duration_sec')],
        },
      ],
    })
    const plan = buildPlanFromFreeWorkout({ session: s, exercises: DEFS, name: 'Gym A' })
    expect(plan.status).toBe('active')
    expect(plan.source).toBe('user')
    expect(plan.days).toHaveLength(1)
    const exs = plan.days[0].exercises
    expect(exs.map((e) => e.exerciseId)).toEqual(['ex-0', 'ex-1'])
    expect(exs[0].sets).toHaveLength(2)
    expect(exs[0].restBetweenSetsSec).toBe(120)
    expect(exs[0].sets[0]).toEqual({
      reps: { kind: 'fixed', value: 10 },
      weightKg: { kind: 'fixed', value: 60 },
    })
    // duration exercise keeps its seconds target
    expect(exs[1].sets[0]).toEqual({ durationSec: { kind: 'fixed', value: 45 } })
  })
})
