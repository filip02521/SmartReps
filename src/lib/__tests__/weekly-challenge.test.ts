import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

// Mock Dexie db — only workoutSessions table needed
const mockWorkoutSessionsWhere = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: (...args: unknown[]) => mockWorkoutSessionsWhere(...args),
    },
  },
}))

import {
  getActiveWeeklyChallenges,
  submitChallengeProgress,
  getWeeklyChallengeLeaderboard,
  getMyWeeklyChallengeEntry,
  getWeeklyChallengeParticipantCount,
  ensureWeeklyChallenge,
  calculateChallengeProgress,
  calculateAllChallengeProgress,
  scoreChallenges,
  selectRelevantChallenges,
  getChallengeContext,
  MAX_DISPLAY_NAME_LENGTH,
  type WeeklyChallenge,
} from '@/lib/weekly-challenge'
import type { LocalWorkoutSession } from '@/lib/db'

function makeChallenge(overrides: Partial<WeeklyChallenge> = {}): WeeklyChallenge {
  return {
    id: 'ch-1',
    week_key: '2025-W03',
    program: 'pushups',
    challenge_type: 'volume',
    target_reps: 100,
    title: 'Test challenge',
    description: '',
    starts_at: '2025-01-13T00:00:00Z',
    ends_at: '2025-01-20T00:00:00Z',
    ...overrides,
  }
}

function makeSession(overrides: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 's-1',
    program: 'pushups',
    cycleId: 'cyc-1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2025-01-15T10:00:00Z',
    setResults: [
      { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
      { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 18, passed: false },
    ],
    ...overrides,
  } as LocalWorkoutSession
}

function setupSessions(sessions: LocalWorkoutSession[]): void {
  const chain = {
    equals: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(sessions),
    }),
  }
  mockWorkoutSessionsWhere.mockReturnValue(chain)
}

describe('weekly-challenge — getActiveWeeklyChallenges', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockWorkoutSessionsWhere.mockReset()
  })

  it('returns challenge array', async () => {
    const challenges = [makeChallenge(), makeChallenge({ id: 'ch-2', challenge_type: 'consistency' })]
    mockRpc.mockResolvedValueOnce({ data: challenges, error: null })
    const result = await getActiveWeeklyChallenges()
    expect(result).toHaveLength(2)
    expect(result[0].challenge_type).toBe('volume')
    expect(result[1].challenge_type).toBe('consistency')
  })

  it('returns empty array when RPC returns null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await getActiveWeeklyChallenges()
    expect(result).toEqual([])
  })

  it('throws on RPC error when both new and legacy RPC fail', async () => {
    // New RPC fails
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } })
    // Legacy fallback also fails
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'legacy rpc error' } })
    await expect(getActiveWeeklyChallenges()).rejects.toThrow('rpc error')
  })

  it('falls back to legacy singular RPC when new plural RPC does not exist', async () => {
    // New RPC fails (function not found)
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Could not find the function get_active_weekly_challenges in the schema cache' },
    })
    // Legacy RPC returns a single challenge
    const legacyChallenge = {
      id: 'ch-legacy',
      week_key: '2025-W03',
      program: 'pushups',
      target_reps: 100,
      title: 'Legacy',
      description: '',
      starts_at: '2025-01-13T00:00:00Z',
      ends_at: '2025-01-20T00:00:00Z',
    }
    mockRpc.mockResolvedValueOnce({ data: legacyChallenge, error: null })
    const result = await getActiveWeeklyChallenges()
    expect(result).toHaveLength(1)
    expect(result[0].challenge_type).toBe('volume')
    expect(result[0].id).toBe('ch-legacy')
  })

  it('parses string data response', async () => {
    const challenges = [makeChallenge()]
    mockRpc.mockResolvedValueOnce({ data: JSON.stringify(challenges), error: null })
    const result = await getActiveWeeklyChallenges()
    expect(result).toHaveLength(1)
  })
})

describe('weekly-challenge — submitChallengeProgress', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('submits with correct params', async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: 'e-1', is_new_best: true }, error: null })
    await submitChallengeProgress({ challengeId: 'ch-1', progressValue: 85, displayName: 'Filip' })
    expect(mockRpc).toHaveBeenCalledWith('submit_challenge_progress', {
      p_challenge_id: 'ch-1',
      p_progress_value: 85,
      p_display_name: 'Filip',
    })
  })

  it('truncates display name to MAX_DISPLAY_NAME_LENGTH', async () => {
    const longName = 'A'.repeat(100)
    mockRpc.mockResolvedValueOnce({ data: { id: 'e-1', is_new_best: true }, error: null })
    await submitChallengeProgress({ challengeId: 'ch-1', progressValue: 10, displayName: longName })
    const callArgs = mockRpc.mock.calls[0][1] as { p_display_name: string }
    expect(callArgs.p_display_name.length).toBe(MAX_DISPLAY_NAME_LENGTH)
  })

  it('throws not_authenticated on auth error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not_authenticated' } })
    await expect(submitChallengeProgress({ challengeId: 'ch-1', progressValue: 10 })).rejects.toThrow('not_authenticated')
  })

  it('throws challenge_not_active on expired challenge', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'challenge_not_active' } })
    await expect(submitChallengeProgress({ challengeId: 'ch-1', progressValue: 10 })).rejects.toThrow('challenge_not_active')
  })
})

describe('weekly-challenge — getWeeklyChallengeLeaderboard', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns entries array', async () => {
    const entries = [
      { id: 'e-1', user_id: 'u-1', total_reps: 100, display_name: 'A', created_at: 't', rank: 1 },
      { id: 'e-2', user_id: 'u-2', total_reps: 90, display_name: 'B', created_at: 't', rank: 2 },
    ]
    mockRpc.mockResolvedValueOnce({ data: entries, error: null })
    const result = await getWeeklyChallengeLeaderboard('ch-1')
    expect(result).toHaveLength(2)
    expect(result[0].rank).toBe(1)
  })

  it('returns empty array when RPC returns non-array', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await getWeeklyChallengeLeaderboard('ch-1')
    expect(result).toEqual([])
  })
})

describe('weekly-challenge — getMyWeeklyChallengeEntry', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns entry when found', async () => {
    const entry = { id: 'e-1', challenge_id: 'ch-1', total_reps: 85, display_name: 'Me', created_at: 't', updated_at: 't' }
    mockRpc.mockResolvedValueOnce({ data: entry, error: null })
    const result = await getMyWeeklyChallengeEntry('ch-1')
    expect(result).toEqual(entry)
  })

  it('returns null when no entry', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await getMyWeeklyChallengeEntry('ch-1')
    expect(result).toBeNull()
  })
})

describe('weekly-challenge — getWeeklyChallengeParticipantCount', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns count as number', async () => {
    mockRpc.mockResolvedValueOnce({ data: 42, error: null })
    const result = await getWeeklyChallengeParticipantCount('ch-1')
    expect(result).toBe(42)
  })

  it('returns 0 when data is null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await getWeeklyChallengeParticipantCount('ch-1')
    expect(result).toBe(0)
  })
})

describe('weekly-challenge — ensureWeeklyChallenge', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns true on success', async () => {
    mockRpc.mockResolvedValueOnce({ data: ['ch-1', 'ch-2'], error: null })
    const result = await ensureWeeklyChallenge()
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })
    const result = await ensureWeeklyChallenge()
    expect(result).toBe(false)
  })
})

// ── Progress calculation tests (anti-cheat core) ──

describe('calculateChallengeProgress — volume', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockWorkoutSessionsWhere.mockReset()
  })

  it('sums actual reps from completed sessions within challenge period', async () => {
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 100 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 18, passed: false },
        ],
      }),
      makeSession({
        id: 's-2',
        startedAt: '2025-01-16T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 25 }, actual: 25, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    // 20 + 18 + 25 = 63
    expect(result.current).toBe(63)
    expect(result.target).toBe(100)
    expect(result.achieved).toBe(false)
    expect(result.pct).toBe(63)
  })

  it('excludes sessions outside challenge period', async () => {
    const ch = makeChallenge({ challenge_type: 'volume' })
    setupSessions([
      makeSession({
        id: 's-before',
        startedAt: '2025-01-10T10:00:00Z',
        setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true }],
      }),
      makeSession({
        id: 's-after',
        startedAt: '2025-01-25T10:00:00Z',
        setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true }],
      }),
      makeSession({
        id: 's-during',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true }],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(20)
  })

  it('returns 0 when no completed sessions', async () => {
    const ch = makeChallenge({ challenge_type: 'volume' })
    setupSessions([])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
    expect(result.achieved).toBe(false)
  })

  it('does not count negative actual values', async () => {
    const ch = makeChallenge({ challenge_type: 'volume' })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: -5, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(20)
  })

  it('marks achieved when current >= target', async () => {
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 50 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 30 }, actual: 30, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 30 }, actual: 25, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(55)
    expect(result.achieved).toBe(true)
    expect(result.pct).toBe(100)
  })

  it('handles boundary: session at exact start is included, at exact end is excluded', async () => {
    const ch = makeChallenge({ challenge_type: 'volume' })
    setupSessions([
      makeSession({
        id: 's-start',
        startedAt: '2025-01-13T00:00:00Z',
        setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true }],
      }),
      makeSession({
        id: 's-end',
        startedAt: '2025-01-20T00:00:00Z',
        setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true }],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    // Only s-start counts (s-end is at exact end = exclusive)
    expect(result.current).toBe(20)
  })
})

describe('calculateChallengeProgress — consistency', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockWorkoutSessionsWhere.mockReset()
  })

  it('counts completed sessions this week', async () => {
    const ch = makeChallenge({ challenge_type: 'consistency', target_reps: 3 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-14T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-16T10:00:00Z' }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(2)
    expect(result.target).toBe(3)
    expect(result.achieved).toBe(false)
    expect(result.pct).toBe(67)
  })

  it('marks achieved when session count >= target', async () => {
    const ch = makeChallenge({ challenge_type: 'consistency', target_reps: 2 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-14T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-16T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2025-01-18T10:00:00Z' }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(3)
    expect(result.achieved).toBe(true)
  })

  it('returns 0 when no sessions', async () => {
    const ch = makeChallenge({ challenge_type: 'consistency', target_reps: 3 })
    setupSessions([])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
  })

  it('does not count sessions with empty setResults', async () => {
    const ch = makeChallenge({ challenge_type: 'consistency', target_reps: 3 })
    setupSessions([
      makeSession({ id: 's-empty', startedAt: '2025-01-15T10:00:00Z', setResults: [] }),
      makeSession({ id: 's-real', startedAt: '2025-01-16T10:00:00Z' }),
    ])
    const result = await calculateChallengeProgress(ch)
    // Only the session with recorded sets counts
    expect(result.current).toBe(1)
  })
})

describe('calculateChallengeProgress — precision', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockWorkoutSessionsWhere.mockReset()
  })

  it('returns 1 when any session has all sets passed', async () => {
    const ch = makeChallenge({ challenge_type: 'precision', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-fail',
        startedAt: '2025-01-14T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 15, passed: false },
        ],
      }),
      makeSession({
        id: 's-pass',
        startedAt: '2025-01-16T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 22, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
    expect(result.achieved).toBe(true)
  })

  it('returns 0 when no session has all sets passed', async () => {
    const ch = makeChallenge({ challenge_type: 'precision', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-fail',
        startedAt: '2025-01-14T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 15, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
    expect(result.achieved).toBe(false)
  })

  it('returns 0 when session has empty setResults', async () => {
    const ch = makeChallenge({ challenge_type: 'precision', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-empty',
        startedAt: '2025-01-14T10:00:00Z',
        setResults: [],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
  })
})

describe('calculateChallengeProgress — personal_best', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockWorkoutSessionsWhere.mockReset()
  })

  it('returns reps above previous max when beaten', async () => {
    const ch = makeChallenge({ challenge_type: 'personal_best', target_reps: 1 })
    // Sessions include both this week and previous weeks
    setupSessions([
      // Previous week session with max 25
      makeSession({
        id: 's-prev',
        startedAt: '2025-01-08T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 25 }, actual: 25, passed: true },
        ],
      }),
      // This week session with max 30
      makeSession({
        id: 's-this',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 30 }, actual: 30, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    // 30 - 25 = 5 reps above previous max
    expect(result.current).toBe(5)
    expect(result.achieved).toBe(true)
  })

  it('returns 0 when max not beaten', async () => {
    const ch = makeChallenge({ challenge_type: 'personal_best', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-prev',
        startedAt: '2025-01-08T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 30 }, actual: 30, passed: true },
        ],
      }),
      makeSession({
        id: 's-this',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 25 }, actual: 25, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
    expect(result.achieved).toBe(false)
  })

  it('returns 0 when no previous sessions exist (new user establishes the record)', async () => {
    const ch = makeChallenge({ challenge_type: 'personal_best', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-this',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    // No baseline record → nothing to beat; the first week establishes
    // the record instead of submitting a raw max as "progress".
    expect(result.current).toBe(0)
    expect(result.achieved).toBe(false)
  })
})

describe('calculateChallengeProgress — power category', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('marathon: best single-session total, not the weekly sum', async () => {
    const ch = makeChallenge({ challenge_type: 'marathon', target_reps: 45 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-14T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 25, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
        ],
      }),
      makeSession({
        id: 's-2',
        startedAt: '2025-01-16T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 30 }, actual: 30, passed: true },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    // Weekly sum would be 75; the marathon metric is the best session (45)
    expect(result.current).toBe(45)
    expect(result.achieved).toBe(true)
  })

  it('max_set: best single set across sessions', async () => {
    const ch = makeChallenge({ challenge_type: 'max_set', target_reps: 25 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 28, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 12, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(28)
    expect(result.achieved).toBe(true)
  })

  it('grinder: counts total completed sets', async () => {
    const ch = makeChallenge({ challenge_type: 'grinder', target_reps: 5 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-14T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
          { setNumber: 3, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
        ],
      }),
      makeSession({
        id: 's-2',
        startedAt: '2025-01-16T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 10, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 10 }, actual: 8, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(5)
    expect(result.achieved).toBe(true)
  })
})

describe('calculateChallengeProgress — habit category', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('daily: counts distinct local days, ignores empty sessions', async () => {
    const ch = makeChallenge({ challenge_type: 'daily', target_reps: 3 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-14T08:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-14T18:00:00Z' }), // same day
      makeSession({ id: 's-3', startedAt: '2025-01-16T10:00:00Z' }),
      makeSession({ id: 's-empty', startedAt: '2025-01-17T10:00:00Z', setResults: [] }),
    ])
    const result = await calculateChallengeProgress(ch)
    // 2 distinct trained days (14th + 16th); empty session adds nothing
    expect(result.current).toBe(2)
    expect(result.achieved).toBe(false)
  })

  it('early_bird: session before 9:00 local', async () => {
    const ch = makeChallenge({ challenge_type: 'early_bird', target_reps: 1 })
    const before9 = new Date('2025-01-15T07:30:00')
    setupSessions([
      makeSession({ id: 's-1', startedAt: before9.toISOString() }),
      makeSession({ id: 's-2', startedAt: new Date('2025-01-16T15:00:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
    expect(result.achieved).toBe(true)
  })

  it('early_bird: no session before 9 → 0', async () => {
    const ch = makeChallenge({ challenge_type: 'early_bird', target_reps: 1 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date('2025-01-15T10:00:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
  })

  it('night_owl: session at/after 20:00 local', async () => {
    const ch = makeChallenge({ challenge_type: 'night_owl', target_reps: 1 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date('2025-01-15T21:30:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
  })

  it('weekend: Saturday session counts, weekday does not', async () => {
    const ch = makeChallenge({ challenge_type: 'weekend', target_reps: 1 })
    // 2025-01-18 is a Saturday, 2025-01-15 a Wednesday
    setupSessions([
      makeSession({ id: 's-mid', startedAt: new Date('2025-01-15T12:00:00').toISOString() }),
      makeSession({ id: 's-sat', startedAt: new Date('2025-01-18T12:00:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
  })

  it('double: two sessions the same day', async () => {
    const ch = makeChallenge({ challenge_type: 'double', target_reps: 1 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date('2025-01-15T08:00:00').toISOString() }),
      makeSession({ id: 's-2', startedAt: new Date('2025-01-15T19:00:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
  })

  it('double: sessions on different days → 0', async () => {
    const ch = makeChallenge({ challenge_type: 'double', target_reps: 1 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date('2025-01-15T08:00:00').toISOString() }),
      makeSession({ id: 's-2', startedAt: new Date('2025-01-16T19:00:00').toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(0)
  })
})

describe('calculateChallengeProgress — skill + records', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('perfect_pair: counts sessions with all sets passed', async () => {
    const ch = makeChallenge({ challenge_type: 'perfect_pair', target_reps: 2 })
    const perfect = (id: string, startedAt: string) =>
      makeSession({
        id,
        startedAt,
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 20 }, actual: 20, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 20 }, actual: 22, passed: true },
        ],
      })
    setupSessions([
      perfect('s-1', '2025-01-14T10:00:00Z'),
      perfect('s-2', '2025-01-16T10:00:00Z'),
      makeSession({ id: 's-3', startedAt: '2025-01-17T10:00:00Z' }), // has a failed set
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(2)
    expect(result.achieved).toBe(true)
  })

  it('improvement: delta over last week', async () => {
    const ch = makeChallenge({ challenge_type: 'improvement', target_reps: 15 })
    const reps = (n: number) => [
      { setNumber: 1, target: { kind: 'fixed' as const, reps: n }, actual: n, passed: true },
    ]
    setupSessions([
      // Last week: 40 total
      makeSession({ id: 'p-1', startedAt: '2025-01-08T10:00:00Z', setResults: reps(25) }),
      makeSession({ id: 'p-2', startedAt: '2025-01-10T10:00:00Z', setResults: reps(15) }),
      // This week: 55 total → delta 15
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(30) }),
      makeSession({ id: 'w-2', startedAt: '2025-01-16T10:00:00Z', setResults: reps(25) }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(15)
    expect(result.achieved).toBe(true)
  })

  it('improvement: regression floors at 0, no baseline → 0', async () => {
    const ch = makeChallenge({ challenge_type: 'improvement', target_reps: 10 })
    const reps = (n: number) => [
      { setNumber: 1, target: { kind: 'fixed' as const, reps: n }, actual: n, passed: true },
    ]
    // Last week 60, this week 30 → negative delta floors to 0
    setupSessions([
      makeSession({ id: 'p-1', startedAt: '2025-01-08T10:00:00Z', setResults: reps(60) }),
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(30) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    // No last-week sessions at all → nothing to beat
    setupSessions([
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(50) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)
  })
})

describe('calculateChallengeProgress — expanded power pool', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('surplus: counts reps above each set target (all target kinds)', async () => {
    const ch = makeChallenge({ challenge_type: 'surplus', target_reps: 10 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          // fixed 20 → 25 actual = +5
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 25, passed: true },
          // max minReps 10 → 14 actual = +4
          { setNumber: 2, target: { kind: 'max' as const, minReps: 10 }, actual: 14, passed: true },
          // exact 15 → 15 actual = +0
          { setNumber: 3, target: { kind: 'exact' as const, reps: 15 }, actual: 15, passed: true },
          // below target → clamped at 0, no negative
          { setNumber: 4, target: { kind: 'fixed' as const, reps: 20 }, actual: 10, passed: false },
        ],
      }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(9)
  })

  it('dominator: a set at >=150% of target completes it', async () => {
    const ch = makeChallenge({ challenge_type: 'dominator', target_reps: 1 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 30, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)

    // 29 < 30 (150% of 20) → not enough
    setupSessions([
      makeSession({
        id: 's-2',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 29, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)
  })

  it('strong_finish / session_starter: edge set must pass', async () => {
    const finish = makeChallenge({ challenge_type: 'strong_finish', target_reps: 1 })
    const starter = makeChallenge({ challenge_type: 'session_starter', target_reps: 1 })

    // Last set failed → strong_finish fails even if first passed
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-15T10:00:00Z' }), // default: pass, fail
    ])
    expect((await calculateChallengeProgress(finish)).current).toBe(0)
    expect((await calculateChallengeProgress(starter)).current).toBe(1)

    // Last set passed → strong_finish succeeds
    setupSessions([
      makeSession({
        id: 's-2',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 10, passed: false },
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 20 }, actual: 21, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(finish)).current).toBe(1)
    expect((await calculateChallengeProgress(starter)).current).toBe(0)
  })

  it('edge-set metrics sort by setNumber, not array order', async () => {
    const finish = makeChallenge({ challenge_type: 'strong_finish', target_reps: 1 })
    const starter = makeChallenge({ challenge_type: 'session_starter', target_reps: 1 })
    // Imported backups can carry unsorted setResults — the metric must read
    // set 2 (last by setNumber: failed), not the array's last element.
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 20 }, actual: 10, passed: false },
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 21, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(finish)).current).toBe(0)
    expect((await calculateChallengeProgress(starter)).current).toBe(1)
  })

  it('bounce_back respects setNumber order in unsorted data', async () => {
    const ch = makeChallenge({ challenge_type: 'bounce_back', target_reps: 1 })
    // Unsorted array lists the pass first; by setNumber it's pass→fail,
    // which is NOT a bounce-back.
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 20 }, actual: 10, passed: false },
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 21, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)
  })

  it('big_day: sessions on the same day stack, best day wins', async () => {
    const ch = makeChallenge({ challenge_type: 'big_day', target_reps: 40 })
    const reps = (n: number) => [
      { setNumber: 1, target: { kind: 'fixed' as const, reps: n }, actual: n, passed: true },
    ]
    setupSessions([
      // Same local day: 25 + 20 = 45
      makeSession({ id: 's-1', startedAt: new Date('2025-01-15T08:00:00').toISOString(), setResults: reps(25) }),
      makeSession({ id: 's-2', startedAt: new Date('2025-01-15T19:00:00').toISOString(), setResults: reps(20) }),
      // Other day: 35 alone
      makeSession({ id: 's-3', startedAt: new Date('2025-01-17T10:00:00').toISOString(), setResults: reps(35) }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(45)
    expect(result.achieved).toBe(true)
  })
})

describe('calculateChallengeProgress — expanded habit pool', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('weekday_quest: only sessions on the drawn weekday count', async () => {
    const { challengeRequiredWeekday } = await import('@/lib/weekly-challenge')
    const ch = makeChallenge({ challenge_type: 'weekday_quest', target_reps: 1 })
    const required = challengeRequiredWeekday(ch.starts_at) // ISO 1..7, week of 2025-01-13

    // Week of 2025-01-13 (Monday): ISO day N → Jan (12 + N)
    const onRequired = new Date(2025, 0, 12 + required, 10).toISOString()
    const wrongDay = required === 1 ? 2 : 1
    const onWrong = new Date(2025, 0, 12 + wrongDay, 10).toISOString()

    setupSessions([
      makeSession({ id: 's-wrong', startedAt: onWrong }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    setupSessions([
      makeSession({ id: 's-wrong', startedAt: onWrong }),
      makeSession({ id: 's-right', startedAt: onRequired }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)
  })

  it('time windows: morning/lunch/evening boundaries are respected', async () => {
    const morning = makeChallenge({ challenge_type: 'morning_moves', target_reps: 1 })
    const lunch = makeChallenge({ challenge_type: 'lunch_break', target_reps: 1 })
    const evening = makeChallenge({ challenge_type: 'evening_shift', target_reps: 1 })
    const at = (h: number) => new Date(2025, 0, 15, h, 0).toISOString()

    setupSessions([makeSession({ id: 's-1', startedAt: at(8) })])
    expect((await calculateChallengeProgress(morning)).current).toBe(1)
    expect((await calculateChallengeProgress(lunch)).current).toBe(0)
    expect((await calculateChallengeProgress(evening)).current).toBe(0)

    setupSessions([makeSession({ id: 's-1', startedAt: at(13) })])
    expect((await calculateChallengeProgress(morning)).current).toBe(0)
    expect((await calculateChallengeProgress(lunch)).current).toBe(1)

    setupSessions([makeSession({ id: 's-1', startedAt: at(14) })])
    expect((await calculateChallengeProgress(lunch)).current).toBe(0)

    setupSessions([makeSession({ id: 's-1', startedAt: at(19) })])
    expect((await calculateChallengeProgress(evening)).current).toBe(1)

    setupSessions([makeSession({ id: 's-1', startedAt: at(22) })])
    expect((await calculateChallengeProgress(evening)).current).toBe(0)
  })

  it('around_the_clock: needs one early AND one late session (target 2)', async () => {
    const ch = makeChallenge({ challenge_type: 'around_the_clock', target_reps: 2 })
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date(2025, 0, 15, 7).toISOString() }),
      makeSession({ id: 's-2', startedAt: new Date(2025, 0, 16, 8).toISOString() }),
    ])
    // Two early sessions — the late half is still missing
    expect((await calculateChallengeProgress(ch)).current).toBe(1)

    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date(2025, 0, 15, 7).toISOString() }),
      makeSession({ id: 's-3', startedAt: new Date(2025, 0, 16, 21).toISOString() }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(2)
    expect(result.achieved).toBe(true)
  })

  it('sunday_sweat: only Sunday sessions count', async () => {
    const ch = makeChallenge({ challenge_type: 'sunday_sweat', target_reps: 1 })
    // 2025-01-19 is Sunday, 2025-01-18 Saturday
    setupSessions([
      makeSession({ id: 's-1', startedAt: new Date(2025, 0, 18, 10).toISOString() }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    setupSessions([
      makeSession({ id: 's-2', startedAt: new Date(2025, 0, 19, 10).toISOString() }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)
  })
})

describe('calculateChallengeProgress — expanded skill pool', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('hat_trick: three fully-passed sessions required', async () => {
    const ch = makeChallenge({ challenge_type: 'hat_trick', target_reps: 3 })
    const perfect = (id: string, day: number) =>
      makeSession({
        id,
        startedAt: `2025-01-${day}T10:00:00Z`,
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 20, passed: true },
        ],
      })
    setupSessions([perfect('p1', 14), perfect('p2', 15), makeSession({ id: 'f', startedAt: '2025-01-16T10:00:00Z' })])
    expect((await calculateChallengeProgress(ch)).current).toBe(2)

    setupSessions([perfect('p1', 14), perfect('p2', 15), perfect('p3', 16)])
    expect((await calculateChallengeProgress(ch)).current).toBe(3)
  })

  it('flawless_sets: counts individual sets at/above target', async () => {
    const ch = makeChallenge({ challenge_type: 'flawless_sets', target_reps: 4 })
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 20, passed: true }, // ✓
          { setNumber: 2, target: { kind: 'max' as const, minReps: 10 }, actual: 15, passed: true }, // ✓ (max floor)
          { setNumber: 3, target: { kind: 'fixed' as const, reps: 20 }, actual: 19, passed: false }, // ✗
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(2)
  })

  it('sharpshooter: a set landing exactly on target', async () => {
    const ch = makeChallenge({ challenge_type: 'sharpshooter', target_reps: 1 })
    // Overshooting does not count — the bullseye is exact
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 21, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    setupSessions([
      makeSession({
        id: 's-2',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'exact' as const, reps: 18 }, actual: 18, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)
  })

  it('bounce_back: fail followed by pass in the same session', async () => {
    const ch = makeChallenge({ challenge_type: 'bounce_back', target_reps: 1 })
    // Default session: pass then FAIL → no recovery
    setupSessions([makeSession({ id: 's-1', startedAt: '2025-01-15T10:00:00Z' })])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    // Fail then pass → recovered
    setupSessions([
      makeSession({
        id: 's-2',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 20 }, actual: 15, passed: false },
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 20 }, actual: 20, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)
  })

  it('metronome: >=3 sets with spread <= 2', async () => {
    const ch = makeChallenge({ challenge_type: 'metronome', target_reps: 1 })
    // Spread 5 → fails
    setupSessions([
      makeSession({
        id: 's-1',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 15 }, actual: 15, passed: true },
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 15 }, actual: 17, passed: true },
          { setNumber: 3, target: { kind: 'fixed' as const, reps: 15 }, actual: 20, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)

    // Spread 2, three sets → passes
    setupSessions([
      makeSession({
        id: 's-2',
        startedAt: '2025-01-15T10:00:00Z',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed' as const, reps: 15 }, actual: 18, passed: true },
          { setNumber: 2, target: { kind: 'fixed' as const, reps: 15 }, actual: 17, passed: true },
          { setNumber: 3, target: { kind: 'fixed' as const, reps: 15 }, actual: 16, passed: true },
        ],
      }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(1)
  })
})

describe('calculateChallengeProgress — expanded records pool', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  const reps = (n: number) => [
    { setNumber: 1, target: { kind: 'fixed' as const, reps: n }, actual: n, passed: true },
  ]

  it('volume_record: this week minus best-ever week total', async () => {
    const ch = makeChallenge({ challenge_type: 'volume_record', target_reps: 1 })
    setupSessions([
      // Best previous week: 40 + 20 = 60
      makeSession({ id: 'p-1', startedAt: '2025-01-07T10:00:00Z', setResults: reps(40) }),
      makeSession({ id: 'p-2', startedAt: '2025-01-09T10:00:00Z', setResults: reps(20) }),
      // Older, weaker week (30) — ignored by the max
      makeSession({ id: 'p-3', startedAt: '2024-12-30T10:00:00Z', setResults: reps(30) }),
      // This week: 65 → delta 5
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(65) }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(5)
    expect(result.achieved).toBe(true)
  })

  it('volume_record: no prior history → nothing to beat', async () => {
    const ch = makeChallenge({ challenge_type: 'volume_record', target_reps: 1 })
    setupSessions([
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(80) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)
  })

  it('session_record: best session this week minus best-ever session', async () => {
    const ch = makeChallenge({ challenge_type: 'session_record', target_reps: 1 })
    setupSessions([
      // Previous best single session: 45
      makeSession({ id: 'p-1', startedAt: '2025-01-08T10:00:00Z', setResults: reps(45) }),
      // This week: 50 and 30 → best 50 → delta 5
      makeSession({ id: 'w-1', startedAt: '2025-01-14T10:00:00Z', setResults: reps(50) }),
      makeSession({ id: 'w-2', startedAt: '2025-01-16T10:00:00Z', setResults: reps(30) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(5)
  })

  it('day_record: best day this week minus best-ever day', async () => {
    const ch = makeChallenge({ challenge_type: 'day_record', target_reps: 1 })
    setupSessions([
      // Previous best day: two sessions 25 + 25 = 50 on 2025-01-08
      makeSession({ id: 'p-1', startedAt: '2025-01-08T08:00:00Z', setResults: reps(25) }),
      makeSession({ id: 'p-2', startedAt: '2025-01-08T19:00:00Z', setResults: reps(25) }),
      // This week: 55 in one day → delta 5
      makeSession({ id: 'w-1', startedAt: '2025-01-15T10:00:00Z', setResults: reps(55) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(5)
  })

  it('beat_average: week total minus 4-week average of active weeks', async () => {
    const ch = makeChallenge({ challenge_type: 'beat_average', target_reps: 1 })
    setupSessions([
      // Two active weeks in the window: 40 and 60 → avg 50
      makeSession({ id: 'a-1', startedAt: '2025-01-06T10:00:00Z', setResults: reps(40) }),
      makeSession({ id: 'a-2', startedAt: '2024-12-30T10:00:00Z', setResults: reps(60) }),
      // Week outside the 4-week window — must not affect the average
      makeSession({ id: 'old', startedAt: '2024-12-10T10:00:00Z', setResults: reps(200) }),
      // This week: 60 → delta 10
      makeSession({ id: 'w-1', startedAt: '2025-01-15T10:00:00Z', setResults: reps(60) }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(10)
    expect(result.achieved).toBe(true)
  })

  it('beat_average: fractional sub-0.5 lead still counts as beaten', async () => {
    const ch = makeChallenge({ challenge_type: 'beat_average', target_reps: 1 })
    setupSessions([
      // Three active weeks: 50, 51, 51 → avg 50.67
      makeSession({ id: 'a-1', startedAt: '2025-01-06T10:00:00Z', setResults: reps(50) }),
      makeSession({ id: 'a-2', startedAt: '2024-12-30T10:00:00Z', setResults: reps(51) }),
      makeSession({ id: 'a-3', startedAt: '2024-12-23T10:00:00Z', setResults: reps(51) }),
      // This week: 51 > 50.67 — beaten by 0.33; Math.round would zero it
      makeSession({ id: 'w-1', startedAt: '2025-01-15T10:00:00Z', setResults: reps(51) }),
    ])
    const result = await calculateChallengeProgress(ch)
    expect(result.current).toBe(1)
    expect(result.achieved).toBe(true)
  })

  it('beat_average: no history in window → 0', async () => {
    const ch = makeChallenge({ challenge_type: 'beat_average', target_reps: 1 })
    setupSessions([
      makeSession({ id: 'w-1', startedAt: '2025-01-15T10:00:00Z', setResults: reps(100) }),
    ])
    expect((await calculateChallengeProgress(ch)).current).toBe(0)
  })
})

describe('challenge categories', () => {
  it('every type maps to a known category and draws cover all four', async () => {
    const { CHALLENGE_CATEGORY, CHALLENGE_CATEGORY_ORDER, typeCategory, isKnownChallengeType } =
      await import('@/lib/weekly-challenge')
    const types = Object.keys(CHALLENGE_CATEGORY)
    expect(types).toHaveLength(34)
    for (const cat of CHALLENGE_CATEGORY_ORDER) {
      expect(types.filter((t) => typeCategory(t as never) === cat).length).toBeGreaterThan(0)
    }
    expect(isKnownChallengeType('marathon')).toBe(true)
    expect(isKnownChallengeType('not_a_type')).toBe(false)
    // Inherited property names must not pass the guard — a hostile/malformed
    // row with 'constructor' would otherwise crash icon/category lookups.
    for (const inherited of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) {
      expect(isKnownChallengeType(inherited)).toBe(false)
      expect(typeCategory(inherited as never)).toBe('power')
    }
  })
})

describe('calculateAllChallengeProgress', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('calculates progress for multiple challenges', async () => {
    const challenges = [
      makeChallenge({ id: 'ch-vol', challenge_type: 'volume', target_reps: 100 }),
      makeChallenge({ id: 'ch-con', challenge_type: 'consistency', target_reps: 3 }),
    ]
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-15T10:00:00Z' }),
    ])
    const results = await calculateAllChallengeProgress(challenges)
    expect(results).toHaveLength(2)
    expect(results[0].challengeType).toBe('volume')
    expect(results[1].challengeType).toBe('consistency')
  })
})

describe('getChallengeContext', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('returns recentAverage 0 and difficulty unknown when no history', async () => {
    setupSessions([])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 100 })
    const ctx = await getChallengeContext(ch)
    expect(ctx.recentAverage).toBe(0)
    expect(ctx.difficulty).toBe('unknown')
  })

  it('calculates recentAverage for volume from last 4 weeks', async () => {
    // One session in each of the 4 active weeks before the challenge week
    // (weeks of Dec 16, Dec 23, Dec 30, Jan 6 — all within the 4-week window)
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2024-12-17T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2024-12-24T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2024-12-31T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-08T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 100 })
    const ctx = await getChallengeContext(ch)
    // 4 sessions × 38 reps = 152 total / 4 active weeks = 38
    expect(ctx.recentAverage).toBe(38)
    // target 100 / avg 38 = 2.63 → hard
    expect(ctx.difficulty).toBe('hard')
  })

  it('averages per active week, not per session', async () => {
    // 4 sessions in the SAME week → 1 active week → average is the full
    // week total, not total/4 (prevents understating typical volume for
    // users who train multiple times in one week)
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-08T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-09T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2025-01-10T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-11T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 100 })
    const ctx = await getChallengeContext(ch)
    // 152 total reps / 1 active week = 152
    expect(ctx.recentAverage).toBe(152)
  })

  it('rates easy when target is well below average', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2024-12-17T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2024-12-24T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2024-12-31T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-08T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 20 })
    const ctx = await getChallengeContext(ch)
    expect(ctx.difficulty).toBe('easy')
  })

  it('rates challenging when target is close to average', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2024-12-17T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2024-12-24T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2024-12-31T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-08T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 40 })
    const ctx = await getChallengeContext(ch)
    expect(ctx.difficulty).toBe('challenging')
  })

  it('calculates previousMax for personal_best', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-08T10:00:00Z', setResults: [
        { setNumber: 1, target: { kind: 'fixed', reps: 25 }, actual: 25, passed: true },
      ] }),
    ])
    const ch = makeChallenge({ challenge_type: 'personal_best', target_reps: 1 })
    const ctx = await getChallengeContext(ch)
    expect(ctx.previousMax).toBe(25)
  })
})

describe('scoreChallenges', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('ranks challenges with recent activity higher', async () => {
    const now = Date.now()
    const recentDate = new Date(now - 5 * 86400000).toISOString()
    setupSessions([
      makeSession({ id: 's-1', program: 'pushups', startedAt: recentDate }),
      makeSession({ id: 's-2', program: 'pushups', startedAt: recentDate }),
    ])

    const challenges = [
      makeChallenge({ id: 'ch-push', program: 'pushups', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-pull', program: 'pullups', challenge_type: 'volume' }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const scored = await scoreChallenges(challenges, progress)

    expect(scored[0].challenge.id).toBe('ch-push')
    expect(scored[0].score).toBeGreaterThan(scored[1].score)
  })

  it('marks the top challenge as recommended', async () => {
    setupSessions([])
    const challenges = [
      makeChallenge({ id: 'ch-1', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-2', challenge_type: 'consistency' }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const scored = await scoreChallenges(challenges, progress)

    expect(scored[0].recommended).toBe(true)
    expect(scored[1].recommended).toBe(false)
  })

  it('penalizes already-achieved challenges', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-15T10:00:00Z' }),
    ])
    const challenges = [
      makeChallenge({ id: 'ch-achieved', challenge_type: 'volume', target_reps: 10 }),
      makeChallenge({ id: 'ch-not-achieved', challenge_type: 'consistency', target_reps: 5 }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const scored = await scoreChallenges(challenges, progress)

    expect(scored[0].challenge.id).toBe('ch-not-achieved')
  })
})

describe('selectRelevantChallenges', () => {
  beforeEach(() => {
    mockWorkoutSessionsWhere.mockReset()
  })

  it('limits to specified count', async () => {
    setupSessions([])
    const challenges = [
      makeChallenge({ id: 'ch-1', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-2', challenge_type: 'consistency' }),
      makeChallenge({ id: 'ch-3', challenge_type: 'precision' }),
      makeChallenge({ id: 'ch-4', challenge_type: 'personal_best' }),
      makeChallenge({ id: 'ch-5', program: 'pullups', challenge_type: 'volume' }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const selected = await selectRelevantChallenges(challenges, progress, 3)
    expect(selected).toHaveLength(3)
  })

  it('returns fewer if less challenges available', async () => {
    setupSessions([])
    const challenges = [
      makeChallenge({ id: 'ch-1', challenge_type: 'volume' }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const selected = await selectRelevantChallenges(challenges, progress, 3)
    expect(selected).toHaveLength(1)
  })

  it('diversifies challenge types instead of stacking the same type across programs', async () => {
    setupSessions([])
    // Two volume challenges + one consistency + one precision — the top-3
    // should not be volume×3 across programs.
    const challenges = [
      makeChallenge({ id: 'ch-vol-pu', program: 'pushups', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-vol-pl', program: 'pullups', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-vol-sq', program: 'squats', challenge_type: 'volume' }),
      makeChallenge({ id: 'ch-con', program: 'pushups', challenge_type: 'consistency' }),
      makeChallenge({ id: 'ch-pre', program: 'pushups', challenge_type: 'precision' }),
    ]
    const progress = await calculateAllChallengeProgress(challenges)
    const selected = await selectRelevantChallenges(challenges, progress, 3)
    const types = selected.map((s) => s.challenge.challenge_type)
    expect(new Set(types).size).toBe(types.length)
  })
})
