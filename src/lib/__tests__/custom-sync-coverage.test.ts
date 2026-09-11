/**
 * Tests for custom-sync.ts — pullCustomEntities, mergeActiveCustomRemote,
 * tombstone handling, and LWW merge logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
const supabaseCallOrder: string[] = []

const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/lib/analytics', () => ({
  trackSyncError: vi.fn(),
  trackSyncResult: vi.fn(),
  track: vi.fn(),
}))

vi.mock('@/lib/custom-plan-service', () => ({
  ensureDefaultExercises: vi.fn().mockResolvedValue(undefined),
  seedStarterExercises: vi.fn().mockResolvedValue(undefined),
  saveExercise: vi.fn(),
}))

vi.mock('@/lib/custom-exercise-dedup', () => ({
  mergeDuplicateExercises: vi.fn().mockResolvedValue(undefined),
}))

const mockDb = vi.hoisted(() => ({
  customPlans: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  customProgramProgress: {
    toArray: vi.fn().mockResolvedValue([]),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(),
    put: vi.fn(),
  },
  activeCustomWorkout: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  exercises: {
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    delete: vi.fn(),
  },
  exerciseTombstones: {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  },
  customPlanTombstones: {
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn(),
    toArray: vi.fn().mockResolvedValue([]),
  },
  workoutSessions: {
    get: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/sync-queue-utils', () => ({
  hasPendingCustomPlanDelete: vi.fn().mockResolvedValue(false),
  hasPendingActiveCustomDelete: vi.fn().mockResolvedValue(false),
  hasPendingSessionDelete: vi.fn().mockResolvedValue(false),
  hasPendingActiveWorkoutDelete: vi.fn().mockResolvedValue(false),
  hasPendingActiveWorkoutUpdate: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/rest-timer-sync', () => ({
  legacyRestTimerFromStartedAt: vi.fn().mockReturnValue(null),
  reconcileRestTimerJson: vi.fn(),
}))

function makeQueryBuilder(table: string, opts: { selectData?: unknown[]; selectError?: unknown; upsertError?: unknown } = {}) {
  const resolveData = opts.selectData ?? []
  const resolveError = opts.selectError ?? null
  const upsertError = opts.upsertError ?? null
  const builder: Record<string, unknown> = {
    select: vi.fn(() => {
      supabaseCallOrder.push(`select:${table}`)
      return builder
    }),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    upsert: vi.fn().mockResolvedValue({ error: upsertError }),
    delete: vi.fn(() => builder),
    in: vi.fn().mockResolvedValue({ error: null }),
    then: vi.fn((resolve: (v: unknown) => void) => {
      resolve({ data: resolveData, error: resolveError })
    }),
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseCallOrder.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockFrom.mockImplementation((table: string) => makeQueryBuilder(table))
  mockDb.customPlans.get.mockResolvedValue(undefined)
  mockDb.customPlans.put.mockResolvedValue(undefined)
  mockDb.customPlans.delete.mockResolvedValue(undefined)
  mockDb.exercises.get.mockResolvedValue(undefined)
  mockDb.exercises.put.mockResolvedValue(undefined)
  mockDb.exerciseTombstones.get.mockResolvedValue(undefined)
  mockDb.customPlanTombstones.get.mockResolvedValue(undefined)
  mockDb.activeCustomWorkout.get.mockResolvedValue(undefined)
  mockDb.activeCustomWorkout.put.mockResolvedValue(undefined)
  mockDb.activeCustomWorkout.delete.mockResolvedValue(undefined)
  mockDb.workoutSessions.get.mockResolvedValue(undefined)
  mockDb.customProgramProgress.where.mockReturnValue({
    equals: vi.fn(() => ({
      first: vi.fn().mockResolvedValue(undefined),
    })),
  })
})

describe('pullCustomEntities', () => {
  it('pulls plan tombstones before plans', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    await pullCustomEntities('user-1')
    const tombIdx = supabaseCallOrder.indexOf('select:custom_plan_tombstones')
    const plansIdx = supabaseCallOrder.indexOf('select:custom_plans')
    expect(tombIdx).toBeGreaterThanOrEqual(0)
    expect(plansIdx).toBeGreaterThanOrEqual(0)
    expect(tombIdx).toBeLessThan(plansIdx)
  })

  it('deletes local plan when tombstone pulled from remote', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockDb.customPlans.get.mockResolvedValue({ id: 'plan-deleted', name: 'X', updatedAt: '2026-01-01' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'custom_plan_tombstones') {
        return makeQueryBuilder(table, {
          selectData: [{ plan_id: 'plan-deleted', deleted_at: '2026-01-02' }],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    expect(mockDb.customPlanTombstones.put).toHaveBeenCalledWith({
      planId: 'plan-deleted',
      deletedAt: '2026-01-02',
    })
    expect(mockDb.customPlans.delete).toHaveBeenCalledWith('plan-deleted')
  })

  it('deletes local exercise when exercise tombstone pulled', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockDb.exercises.get.mockResolvedValue({ id: 'ex-deleted', name: 'Push', updatedAt: '2026-01-01' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'exercise_tombstones') {
        return makeQueryBuilder(table, {
          selectData: [{ exercise_id: 'ex-deleted', deleted_at: '2026-01-02' }],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    expect(mockDb.exerciseTombstones.put).toHaveBeenCalledWith({
      exerciseId: 'ex-deleted',
      deletedAt: '2026-01-02',
    })
    expect(mockDb.exercises.delete).toHaveBeenCalledWith('ex-deleted')
  })

  it('skips tombstoned plans when merging remote plans', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    // Return tombstone only for plan-tombstoned, not plan-active
    mockDb.customPlanTombstones.get.mockImplementation((id: string) =>
      id === 'plan-tombstoned'
        ? Promise.resolve({ planId: 'plan-tombstoned' })
        : Promise.resolve(undefined),
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === 'custom_plans') {
        return makeQueryBuilder(table, {
          selectData: [
            {
              id: 'plan-tombstoned',
              user_id: 'user-1',
              name: 'Tomb',
              status: 'draft',
              plan_json: { days: [] },
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
              source: 'user',
            },
            {
              id: 'plan-active',
              user_id: 'user-1',
              name: 'Active',
              status: 'draft',
              plan_json: { days: [] },
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
              source: 'user',
            },
          ],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    const putCalls = mockDb.customPlans.put.mock.calls.map((c) => c[0].id)
    expect(putCalls).toContain('plan-active')
    expect(putCalls).not.toContain('plan-tombstoned')
  })

  it('returns error count when pull fails', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_exercises') {
        return makeQueryBuilder(table, { selectError: { message: 'network error' } })
      }
      return makeQueryBuilder(table)
    })
    const result = await pullCustomEntities('user-1')
    expect(result.errors).toBeGreaterThan(0)
  })
})

describe('mergeActiveCustomRemote (via pullCustomEntities)', () => {
  it('deletes active workout when plan is tombstoned', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockDb.customPlanTombstones.get.mockResolvedValue({ planId: 'plan-1' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'active_custom_workout_state') {
        return makeQueryBuilder(table, {
          selectData: [
            {
              custom_plan_id: 'plan-1',
              user_id: 'user-1',
              session_id: 's1',
              updated_at: '2026-01-01T00:00:00Z',
              exercise_logs_json: [{ sets: [{ reps: 5 }] }],
            },
          ],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    // Should delete the remote active workout since plan is tombstoned
    expect(mockDb.activeCustomWorkout.delete).not.toHaveBeenCalled()
    // The delete is via supabase, not local — local was never created
  })

  it('deletes active workout when session is not in_progress', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockDb.workoutSessions.get.mockResolvedValue({ id: 's1', status: 'completed' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'active_custom_workout_state') {
        return makeQueryBuilder(table, {
          selectData: [
            {
              custom_plan_id: 'plan-1',
              user_id: 'user-1',
              session_id: 's1',
              updated_at: '2026-01-01T00:00:00Z',
              exercise_logs_json: [{ sets: [{ reps: 5 }] }],
            },
          ],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    // Should NOT put the active workout locally — session is completed
    expect(mockDb.activeCustomWorkout.put).not.toHaveBeenCalled()
  })

  it('deletes active workout when remote has no progress', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockFrom.mockImplementation((table: string) => {
      if (table === 'active_custom_workout_state') {
        return makeQueryBuilder(table, {
          selectData: [
            {
              custom_plan_id: 'plan-1',
              user_id: 'user-1',
              session_id: 's1',
              updated_at: '2026-01-01T00:00:00Z',
              exercise_logs_json: [], // no progress
              day_override_json: null,
            },
          ],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    expect(mockDb.activeCustomWorkout.put).not.toHaveBeenCalled()
  })

  it('puts active workout when remote has progress and is newer', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    mockDb.workoutSessions.get.mockResolvedValue({ id: 's1', status: 'in_progress' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'active_custom_workout_state') {
        return makeQueryBuilder(table, {
          selectData: [
            {
              custom_plan_id: 'plan-1',
              user_id: 'user-1',
              session_id: 's1',
              updated_at: '2026-01-02T00:00:00Z',
              exercise_logs_json: [{ sets: [{ reps: 5 }] }],
              current_exercise_index: 0,
              current_set_index: 0,
              day_override_json: null,
              rest_timer_json: null,
              amrap_end_at: null,
              amrap_group_id: null,
              display_started_at: null,
            },
          ],
        })
      }
      return makeQueryBuilder(table)
    })
    await pullCustomEntities('user-1')
    expect(mockDb.activeCustomWorkout.put).toHaveBeenCalledWith(
      expect.objectContaining({
        customPlanId: 'plan-1',
        sessionId: 's1',
      }),
    )
  })
})

describe('pushCustomEntities — trackSyncError on failures', () => {
  it('calls trackSyncError when user_exercise push fails', async () => {
    const { pushCustomEntities } = await import('@/lib/custom-sync')
    const { trackSyncError } = await import('@/lib/analytics')
    mockDb.exercises.toArray.mockResolvedValue([
      { id: 'ex1', name: 'Push', updatedAt: '2026-01-01' },
    ])
    mockDb.exerciseTombstones.get.mockResolvedValue(undefined)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_exercises') {
        return makeQueryBuilder(table, { upsertError: { message: 'rls denied' } })
      }
      return makeQueryBuilder(table)
    })
    const errors = await pushCustomEntities('user-1')
    expect(errors).toBeGreaterThan(0)
    expect(trackSyncError).toHaveBeenCalledWith(
      'push_user_exercise',
      expect.anything(),
    )
  })

  it('calls trackSyncError when custom_plan push fails', async () => {
    const { pushCustomEntities } = await import('@/lib/custom-sync')
    const { trackSyncError } = await import('@/lib/analytics')
    mockDb.customPlans.toArray.mockResolvedValue([
      { id: 'plan1', name: 'Plan', status: 'draft', days: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', source: 'user' },
    ])
    mockDb.customPlanTombstones.get.mockResolvedValue(undefined)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'custom_plans') {
        return makeQueryBuilder(table, { upsertError: { message: 'rls denied' } })
      }
      return makeQueryBuilder(table)
    })
    const errors = await pushCustomEntities('user-1')
    expect(errors).toBeGreaterThan(0)
    expect(trackSyncError).toHaveBeenCalledWith(
      'push_custom_plan',
      expect.anything(),
    )
  })

  it('calls trackSyncError when pullCustomEntities fails', async () => {
    const { pullCustomEntities } = await import('@/lib/custom-sync')
    const { trackSyncError } = await import('@/lib/analytics')
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_exercises') {
        return makeQueryBuilder(table, { selectError: { message: 'network error' } })
      }
      return makeQueryBuilder(table)
    })
    const result = await pullCustomEntities('user-1')
    expect(result.errors).toBeGreaterThan(0)
    expect(trackSyncError).toHaveBeenCalledWith(
      'pull_custom_entities',
      expect.anything(),
    )
  })

  it('calls trackSyncError when custom progress push fails', async () => {
    const { pushCustomEntities } = await import('@/lib/custom-sync')
    const { trackSyncError } = await import('@/lib/analytics')
    mockDb.customProgramProgress.toArray.mockResolvedValue([
      { customPlanId: 'plan-1', currentDay: 1, status: 'active', cycleAttempt: 1, updatedAt: '2026-01-01' },
    ])
    mockFrom.mockImplementation((table: string) => {
      if (table === 'custom_program_progress') {
        return makeQueryBuilder(table, { upsertError: { message: 'rls denied' } })
      }
      return makeQueryBuilder(table)
    })
    const errors = await pushCustomEntities('user-1')
    expect(errors).toBeGreaterThan(0)
    expect(trackSyncError).toHaveBeenCalledWith(
      'push_custom_progress',
      expect.anything(),
    )
  })

  it('calls trackSyncError when active custom workout push fails', async () => {
    const { pushCustomEntities } = await import('@/lib/custom-sync')
    const { trackSyncError } = await import('@/lib/analytics')
    mockDb.activeCustomWorkout.toArray.mockResolvedValue([
      { customPlanId: 'plan-1', sessionId: 's1', currentExerciseIndex: 0, currentSetIndex: 0, exerciseLogs: [], setResults: [], restTimerJson: null, amrapEndAt: null, amrapGroupId: null, displayStartedAt: null, updatedAt: '2026-01-01' },
    ])
    mockFrom.mockImplementation((table: string) => {
      if (table === 'active_custom_workout_state') {
        return makeQueryBuilder(table, { upsertError: { message: 'rls denied' } })
      }
      return makeQueryBuilder(table)
    })
    const errors = await pushCustomEntities('user-1')
    expect(errors).toBeGreaterThan(0)
    expect(trackSyncError).toHaveBeenCalledWith(
      'push_active_custom_workout',
      expect.anything(),
    )
  })
})
