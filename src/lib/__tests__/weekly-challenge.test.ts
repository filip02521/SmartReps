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

  it('returns max as current when no previous sessions exist (new user)', async () => {
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
    // No previous max → prevMax = 0 → 20 > 0 → current = 20
    expect(result.current).toBe(20)
    expect(result.achieved).toBe(true)
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
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-08T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-09T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2025-01-10T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-11T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 100 })
    const ctx = await getChallengeContext(ch)
    // 4 sessions × 38 reps = 152 total / 4 weeks = 38
    expect(ctx.recentAverage).toBe(38)
    // target 100 / avg 38 = 2.63 → hard
    expect(ctx.difficulty).toBe('hard')
  })

  it('rates easy when target is well below average', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-08T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-09T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2025-01-10T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-11T10:00:00Z' }),
    ])
    const ch = makeChallenge({ challenge_type: 'volume', target_reps: 20 })
    const ctx = await getChallengeContext(ch)
    expect(ctx.difficulty).toBe('easy')
  })

  it('rates challenging when target is close to average', async () => {
    setupSessions([
      makeSession({ id: 's-1', startedAt: '2025-01-08T10:00:00Z' }),
      makeSession({ id: 's-2', startedAt: '2025-01-09T10:00:00Z' }),
      makeSession({ id: 's-3', startedAt: '2025-01-10T10:00:00Z' }),
      makeSession({ id: 's-4', startedAt: '2025-01-11T10:00:00Z' }),
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
})
