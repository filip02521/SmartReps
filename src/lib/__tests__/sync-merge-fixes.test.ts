/**
 * Regression tests for sync merge bugs fixed in the deep audit:
 *
 * BUG 4/5: mergeBodyWeightRemote matched by timestamp instead of ID.
 *   When a local entry had a different ID than the remote (same timestamp),
 *   the local ID was kept → push created a duplicate cloud row.
 *   Fix: match by ID first; if matched by timestamp, replace local with
 *   remote (delete + add with remote ID).
 *
 * BUG 9: mergeActiveRemote deleted the remote active workout when the
 *   local session was missing (e.g. session pull failed on a new device).
 *   Fix: only delete remote if the local session EXISTS and is NOT in_progress.
 *   If the session is missing, skip the merge — don't destroy remote state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks --------------------------------------------------------------

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/lib/analytics', () => ({
  trackSyncError: vi.fn(),
  track: vi.fn(),
}))

vi.mock('@/lib/sync-queue-utils', () => ({
  hasPendingActiveWorkoutDelete: vi.fn().mockResolvedValue(false),
  hasPendingActiveWorkoutUpdate: vi.fn().mockResolvedValue(false),
  hasPendingSessionDelete: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/rest-timer-sync', () => ({
  legacyRestTimerFromStartedAt: vi.fn().mockReturnValue(null),
  reconcileRestTimerJson: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/enabled-programs-sync', () => ({
  mergeEnabledProgramsFromProfile: vi.fn(),
  mergeEnabledCustomWorkoutsFromProfile: vi.fn(),
  mergeEnabledProgramsFromProgress: vi.fn(),
  mergeUiSettingsFromProfile: vi.fn(),
  mergeSubscriptionFromProfile: vi.fn(),
}))

vi.mock('@/lib/progress-sync-merge', () => ({
  mapRemoteProgressToLocal: vi.fn(),
  shouldPreferLocalProgress: vi.fn(),
}))

vi.mock('@/lib/session-sync-merge', () => ({
  shouldPreferLocalSession: vi.fn(),
}))

vi.mock('@/lib/custom-sync', () => ({
  pullCustomEntities: vi.fn().mockResolvedValue({ errors: 0, tombstoneErrors: 0 }),
  pushCustomEntities: vi.fn().mockResolvedValue(0),
}))

// --- Configurable DB state ---------------------------------------------

let bodyWeightData: Array<{ id: string; weightKg: number; measuredAt: string; note?: string }> = []
let bodyWeightTombstonesData: Array<{ exerciseId: string; deletedAt: string }> = []
let workoutSessionsData: Array<{ id: string; status: string; setResults: unknown[]; startedAt: string }> = []
let activeWorkoutData: Array<{ program: string; sessionId: string; updatedAt: string }> = []

const mockDb = {
  bodyWeight: {
    toArray: vi.fn(() => Promise.resolve([...bodyWeightData])),
    get: vi.fn((id: string) => Promise.resolve(bodyWeightData.find((e) => e.id === id) ?? null)),
    add: vi.fn((entry: { id: string; weightKg: number; measuredAt: string; note?: string }) => {
      bodyWeightData.push(entry)
      return Promise.resolve()
    }),
    update: vi.fn((id: string, patch: Partial<{ weightKg: number; note?: string }>) => {
      const idx = bodyWeightData.findIndex((e) => e.id === id)
      if (idx >= 0) bodyWeightData[idx] = { ...bodyWeightData[idx], ...patch }
      return Promise.resolve()
    }),
    delete: vi.fn((id: string) => {
      bodyWeightData = bodyWeightData.filter((e) => e.id !== id)
      return Promise.resolve()
    }),
    clear: vi.fn(() => { bodyWeightData = []; return Promise.resolve() }),
  },
  bodyWeightTombstones: {
    get: vi.fn((id: string) => Promise.resolve(bodyWeightTombstonesData.find((t) => t.exerciseId === id) ?? null)),
    clear: vi.fn(() => { bodyWeightTombstonesData = []; return Promise.resolve() }),
  },
  workoutSessions: {
    get: vi.fn((id: string) => Promise.resolve(workoutSessionsData.find((s) => s.id === id) ?? null)),
    toArray: vi.fn(() => Promise.resolve([...workoutSessionsData])),
    clear: vi.fn(() => { workoutSessionsData = []; return Promise.resolve() }),
  },
  activeWorkout: {
    get: vi.fn((program: string) => Promise.resolve(activeWorkoutData.find((a) => a.program === program) ?? null)),
    put: vi.fn((row: { program: string; sessionId: string; updatedAt: string }) => {
      const idx = activeWorkoutData.findIndex((a) => a.program === row.program)
      if (idx >= 0) activeWorkoutData[idx] = row
      else activeWorkoutData.push(row)
      return Promise.resolve()
    }),
    delete: vi.fn((program: string) => {
      activeWorkoutData = activeWorkoutData.filter((a) => a.program !== program)
      return Promise.resolve()
    }),
    toArray: vi.fn(() => Promise.resolve([...activeWorkoutData])),
    clear: vi.fn(() => { activeWorkoutData = []; return Promise.resolve() }),
  },
  programProgress: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  maxTests: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  sessionTombstones: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  aiInsights: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  customPlans: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  exercises: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  customProgramProgress: { toArray: vi.fn().mockResolvedValue([]), where: vi.fn(), clear: vi.fn() },
  activeCustomWorkout: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), delete: vi.fn(), clear: vi.fn() },
  exerciseTombstones: { get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  customPlanTombstones: { get: vi.fn(), put: vi.fn(), clear: vi.fn() },
  syncQueue: { toArray: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), clear: vi.fn() },
  achievementUnlocks: { clear: vi.fn() },
  aiAnalysisCache: { clear: vi.fn() },
  aiPlanDrafts: { clear: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: mockDb }))

// --- Tests --------------------------------------------------------------

describe('mergeBodyWeightRemote — ID-based matching (BUG 4/5)', () => {
  beforeEach(() => {
    bodyWeightData = []
    bodyWeightTombstonesData = []
    vi.clearAllMocks()
  })

  it('matches by ID when local entry has the same ID as remote', async () => {
    bodyWeightData = [{ id: 'bw-1', weightKg: 80, measuredAt: '2026-09-01T10:00:00.000Z' }]

    const { mergeBodyWeightRemote } = await import('@/lib/sync')
    await mergeBodyWeightRemote({
      id: 'bw-1',
      weight_kg: 81,
      measured_at: '2026-09-01T10:00:00.000Z',
      note: 'updated',
    })

    expect(bodyWeightData.length).toBe(1)
    expect(bodyWeightData[0].id).toBe('bw-1')
    expect(bodyWeightData[0].weightKg).toBe(81)
  })

  it('replaces local entry with remote ID when matched by timestamp but different ID', async () => {
    bodyWeightData = [{ id: 'bw-local-1', weightKg: 80, measuredAt: '2026-09-01T10:00:00.000Z' }]

    const { mergeBodyWeightRemote } = await import('@/lib/sync')
    await mergeBodyWeightRemote({
      id: 'bw-remote-1',
      weight_kg: 81,
      measured_at: '2026-09-01T10:00:00.000Z',
      note: 'updated',
    })

    // The local entry should be replaced with the remote one (remote ID)
    expect(bodyWeightData.length).toBe(1)
    expect(bodyWeightData[0].id).toBe('bw-remote-1')
    expect(bodyWeightData[0].weightKg).toBe(81)
  })

  it('skips tombstoned body weight entries', async () => {
    bodyWeightTombstonesData = [{ exerciseId: 'bw-1', deletedAt: '2026-09-01T12:00:00.000Z' }]

    const { mergeBodyWeightRemote } = await import('@/lib/sync')
    await mergeBodyWeightRemote({
      id: 'bw-1',
      weight_kg: 81,
      measured_at: '2026-09-01T10:00:00.000Z',
      note: null,
    })

    // Tombstoned entry should NOT be added
    expect(bodyWeightData.length).toBe(0)
  })

  it('adds new entry when no local match by ID or timestamp', async () => {
    bodyWeightData = []

    const { mergeBodyWeightRemote } = await import('@/lib/sync')
    await mergeBodyWeightRemote({
      id: 'bw-new',
      weight_kg: 75,
      measured_at: '2026-09-02T10:00:00.000Z',
      note: 'new entry',
    })

    expect(bodyWeightData.length).toBe(1)
    expect(bodyWeightData[0].id).toBe('bw-new')
    expect(bodyWeightData[0].weightKg).toBe(75)
  })
})

describe('mergeActiveRemote — session-missing safety (BUG 9)', () => {
  beforeEach(() => {
    workoutSessionsData = []
    activeWorkoutData = []
    vi.clearAllMocks()
    // Default: supabase calls return no error
    mockFrom.mockReturnValue({
      delete: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
    })
  })

  it('does NOT delete remote active workout when local session is missing', async () => {
    // No local session exists (e.g. new device, session pull failed)
    workoutSessionsData = []

    const deleteSpy = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      delete: deleteSpy,
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
    })

    const { mergeActiveRemote } = await import('@/lib/sync')
    await mergeActiveRemote('u1', {
      program: 'pushups',
      session_id: 'sess-1',
      current_set: 3,
      set_results_json: [{ actual: 10 }],
      rest_started_at: null,
      rest_timer_json: null,
      display_started_at: null,
      failed_retry_used: null,
      updated_at: '2026-09-01T10:00:00.000Z',
    } as never)

    // Should NOT call supabase delete (session is missing, not completed)
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('deletes remote active workout when local session exists and is completed', async () => {
    // Local session exists and is completed
    workoutSessionsData = [{
      id: 'sess-1',
      status: 'completed',
      setResults: [],
      startedAt: '2026-09-01T10:00:00.000Z',
    }]

    // Build a proper chainable: from().delete().eq().eq() → thenable
    const deleteResult = { error: null }
    const eqChain = {
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => resolve(deleteResult),
    }
    const deleteSpy = vi.fn(() => eqChain)
    mockFrom.mockReturnValue({
      delete: deleteSpy,
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
    })

    const { mergeActiveRemote } = await import('@/lib/sync')
    await mergeActiveRemote('u1', {
      program: 'pushups',
      session_id: 'sess-1',
      current_set: 3,
      set_results_json: [{ actual: 10 }],
      rest_started_at: null,
      rest_timer_json: null,
      display_started_at: null,
      failed_retry_used: null,
      updated_at: '2026-09-01T10:00:00.000Z',
    } as never)

    // Should call supabase delete (session is completed)
    expect(deleteSpy).toHaveBeenCalled()
  })
})
