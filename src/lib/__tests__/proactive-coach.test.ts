import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSmartRestSuggestion, generatePostWorkoutInsight, detectPlateau, pruneOldAiInsights } from '../ai/proactive-coach'
import { enqueueSync } from '@/lib/sync'
import type { LocalWorkoutSession, LocalAiInsight } from '@/lib/db'

// Controlled store for aiInsights queries — the filter predicate is applied
// for real so the plateau cooldown logic is exercised, not stubbed away.
let mockInsights: LocalAiInsight[] = []
vi.mock('@/lib/db', () => ({
  db: {
    aiInsights: {
      toArray: vi.fn(() => Promise.resolve(mockInsights)),
      delete: vi.fn((id: string) => {
        mockInsights = mockInsights.filter((i) => i.id !== id)
        return Promise.resolve()
      }),
      where: vi.fn(() => ({
        equals: vi.fn((type: string) => ({
          filter: vi.fn((pred: (i: LocalAiInsight) => boolean) => ({
            first: vi.fn(() =>
              Promise.resolve(mockInsights.filter((i) => i.type === type).find(pred)),
            ),
          })),
        })),
      })),
    },
  },
}))

const mockEnqueueSync = vi.hoisted(() =>
  vi.fn((_table?: string, _action?: string, _payload?: unknown) => Promise.resolve()),
)

vi.mock('@/lib/sync', () => ({
  enqueueSync: mockEnqueueSync,
  // Mirror the real observable behavior: cloud delete queued + local row removed.
  deleteAiInsight: vi.fn(async (insight: { id?: string }) => {
    if (!insight.id) return
    await mockEnqueueSync('ai_insights', 'delete', insight)
    const { db } = await import('@/lib/db')
    await db.aiInsights.delete(insight.id)
  }),
}))

// Mock session-summary-insights — compute functions are stubbed per-test;
// pure helpers (primarySetValue, sameTrainingDay) keep their real logic.
vi.mock('@/lib/session-summary-insights', () => ({
  computeBuiltinSessionInsights: vi.fn(() => ({
    prCount: 0,
    progressCount: 1,
    setInsights: new Map([
      ['0-1', { kind: 'improved', deltaVsPrevious: 2 }],
    ]),
  })),
  computeCustomSessionInsights: vi.fn(() => ({
    prCount: 0,
    progressCount: 1,
    setInsights: new Map(),
  })),
  primarySetValue: (set: { actual: { reps?: number; weightKg?: number; durationSec?: number } }, metric: string) => {
    if (metric === 'duration_sec') return set.actual.durationSec ?? 0
    if (metric === 'reps_weight') return (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0)
    return set.actual.reps ?? 0
  },
  sameTrainingDay: (a: LocalWorkoutSession, b: LocalWorkoutSession) => {
    const aCustom = a.programKind === 'custom' || a.program === 'custom'
    const bCustom = b.programKind === 'custom' || b.program === 'custom'
    if (aCustom !== bCustom) return false
    if (aCustom) return a.customPlanId === b.customPlanId && a.dayNumber === b.dayNumber
    return a.program === b.program && a.cycleId === b.cycleId && a.dayNumber === b.dayNumber
  },
}))

// Mock AI client
vi.mock('@/lib/ai/ai-client', () => ({
  chatCompletion: vi.fn(),
  parseJsonResponse: vi.fn(),
  canDisableReasoning: () => false,
  resolveReasoningEffort: () => undefined,
  isGeminiEndpoint: () => false,
  isOpenAiReasoningModel: () => false,
  AiApiError: class extends Error {},
}))

// Mock prompts
vi.mock('@/lib/ai/prompts', () => ({
  buildPostWorkoutPrompt: vi.fn(() => ({
    system: { role: 'system', content: 'sys' },
    user: { role: 'user', content: 'usr' },
  })),
  buildWeeklyReportPrompt: vi.fn(() => ({
    system: { role: 'system', content: 'sys' },
    user: { role: 'user', content: 'usr' },
  })),
}))

// Mock weekly-recap
vi.mock('@/lib/weekly-recap', () => ({
  buildActivityInsights: vi.fn(() => ({
    streakWeeks: 2,
    repsWeekChangePct: 5,
    sessions14d: 3,
    reps14d: 100,
    sessionsPrev14d: 2,
    repsPrev14d: 80,
    sessionsDelta14d: 1,
    bestStreakWeeks: 3,
  })),
}))

// Mock stats-engine
vi.mock('@/lib/stats-engine', () => ({
  getWeekKey: vi.fn(() => '2025-W01'),
  startOfLocalWeek: vi.fn(() => {
    const d = new Date('2025-01-06T00:00:00Z')
    return d
  }),
}))

// Mock custom-session-utils — keep the real detection logic so custom
// sessions route through the custom insight/metric paths.
vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: vi.fn(
    (s: LocalWorkoutSession) => s.programKind === 'custom' || s.program === 'custom',
  ),
}))

describe('getSmartRestSuggestion', () => {
  it('returns firstTime message when no previous actual and no history', () => {
    const result = getSmartRestSuggestion(undefined, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('Pierwsza seria')
  })

  it('returns newCombination message when no previous actual but has history', () => {
    const result = getSmartRestSuggestion(undefined, 10, 'reps', true)
    expect(result).toBeTruthy()
    expect(result).toContain('Nowa kombinacja')
  })

  it('returns firstTime message when previous actual is 0 and no history', () => {
    const result = getSmartRestSuggestion(0, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('Pierwsza seria')
  })

  it('returns newCombination message when previous actual is 0 but has history', () => {
    const result = getSmartRestSuggestion(0, 10, 'reps', true)
    expect(result).toBeTruthy()
    expect(result).toContain('Nowa kombinacja')
  })

  it('returns firstTime message when previous actual is negative and no history', () => {
    const result = getSmartRestSuggestion(-1, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('Pierwsza seria')
  })

  it('returns improved message when previous > target', () => {
    const result = getSmartRestSuggestion(15, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('15')
  })

  it('returns unchanged message when previous === target', () => {
    const result = getSmartRestSuggestion(10, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('tyle samo')
  })

  it('returns challenge message when previous < target (motivate instead of hide)', () => {
    const result = getSmartRestSuggestion(5, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('10')
    expect(result).toContain('5')
  })

  it('returns time-based improved message for seconds unit', () => {
    const result = getSmartRestSuggestion(35, 30, 'seconds')
    expect(result).toBeTruthy()
    expect(result).toContain('35')
    expect(result).toContain('s')
  })
})

describe('generatePostWorkoutInsight', () => {
  const mockSession: LocalWorkoutSession = {
    id: 'session-1',
    program: 'pushups',
    cycleId: 'cycle-1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2025-01-01T10:00:00Z',
    completedAt: '2025-01-01T10:30:00Z',
    passed: true,
    totalReps: 50,
    setResults: [
      { setNumber: 1, actual: 15, target: { kind: 'fixed', reps: 10 }, passed: true },
      { setNumber: 2, actual: 12, target: { kind: 'fixed', reps: 10 }, passed: true },
    ],
  }

  const mockPrevious: LocalWorkoutSession = {
    ...mockSession,
    id: 'session-0',
    totalReps: 40,
    startedAt: '2024-12-25T10:00:00Z',
  }

  it('generates local insight when no AI config', async () => {
    const result = await generatePostWorkoutInsight({
      session: mockSession,
      previous: mockPrevious,
      historicalSessions: [mockPrevious],
      exercises: [],
    })
    expect(result.type).toBe('post_workout')
    expect(result.source).toBe('local')
    expect(result.sessionId).toBe('session-1')
    expect(result.body).toBeTruthy()
  })

  it('falls back to local insight when AI fails', async () => {
    const { chatCompletion } = await import('@/lib/ai/ai-client')
    vi.mocked(chatCompletion).mockRejectedValueOnce(new Error('AI error'))

    const result = await generatePostWorkoutInsight({
      session: mockSession,
      previous: mockPrevious,
      historicalSessions: [mockPrevious],
      exercises: [],
      aiConfig: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
    })
    expect(result.source).toBe('local')
  })

  it('falls back to local insight when AI times out (AbortError)', async () => {
    const { chatCompletion, AiApiError } = await import('@/lib/ai/ai-client')
    const abortError = new AiApiError('Aborted', undefined, 'network')
    abortError.name = 'AbortError'
    vi.mocked(chatCompletion).mockRejectedValueOnce(abortError)

    const result = await generatePostWorkoutInsight({
      session: mockSession,
      previous: mockPrevious,
      historicalSessions: [mockPrevious],
      exercises: [],
      aiConfig: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
    })
    expect(result.source).toBe('local')
  })

  it('prioritizes failed tone when session.passed is false', async () => {
    const failedSession: LocalWorkoutSession = {
      ...mockSession,
      id: 'session-failed',
      passed: false,
      setResults: [
        { setNumber: 1, actual: 5, target: { kind: 'fixed', reps: 10 }, passed: false },
      ],
    }
    const result = await generatePostWorkoutInsight({
      session: failedSession,
      previous: mockPrevious,
      historicalSessions: [mockPrevious],
      exercises: [],
    })
    expect(result.tone).toBe('warning')
    expect(result.body).toContain('Nieudana')
  })

  it('surfaces below-target sets when they dominate (custom sessions always pass)', async () => {
    const { computeCustomSessionInsights } = await import('@/lib/session-summary-insights')
    vi.mocked(computeCustomSessionInsights).mockReturnValueOnce({
      highlights: [],
      prCount: 0,
      progressCount: 0,
      setInsights: new Map([
        ['ex1:1', { kind: 'failed', deltaVsPrevious: -3 }],
        ['ex1:2', { kind: 'failed', deltaVsPrevious: -2 }],
        ['ex2:1', { kind: 'improved', deltaVsPrevious: 1 }],
      ]),
    })
    const customSession: LocalWorkoutSession = {
      ...mockSession,
      id: 'session-custom-missed',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'plan-a',
      passed: true,
      setResults: [],
      exerciseLogs: [],
    }
    const result = await generatePostWorkoutInsight({
      session: customSession,
      historicalSessions: [],
      exercises: [],
    })
    expect(result.tone).toBe('warning')
    expect(result.body).toContain('poniżej celu')
    expect(result.body).toContain('2 z 3')
  })

  it('shows first-time message when no comparable history exists', async () => {
    const { computeBuiltinSessionInsights } = await import('@/lib/session-summary-insights')
    vi.mocked(computeBuiltinSessionInsights).mockReturnValueOnce({
      highlights: [],
      prCount: 0,
      progressCount: 0,
      setInsights: new Map([
        [1, { kind: 'none', deltaVsPrevious: null }],
        [2, { kind: 'none', deltaVsPrevious: null }],
      ]),
    })
    const firstSession: LocalWorkoutSession = { ...mockSession, id: 'session-first' }
    const result = await generatePostWorkoutInsight({
      session: firstSession,
      historicalSessions: [],
      exercises: [],
    })
    expect(result.tone).toBe('insight')
    expect(result.body).toContain('Pierwszy zapisany wynik')
  })

  it('shows mixed message on improved/down tie', async () => {
    const { computeBuiltinSessionInsights } = await import('@/lib/session-summary-insights')
    vi.mocked(computeBuiltinSessionInsights).mockReturnValueOnce({
      highlights: [],
      prCount: 0,
      progressCount: 0,
      setInsights: new Map([
        [1, { kind: 'improved', deltaVsPrevious: 2 }],
        [2, { kind: 'down', deltaVsPrevious: -2 }],
      ]),
    })
    const result = await generatePostWorkoutInsight({
      session: { ...mockSession, id: 'session-mixed' },
      previous: mockPrevious,
      historicalSessions: [mockPrevious],
      exercises: [],
    })
    expect(result.tone).toBe('insight')
    expect(result.body).toContain('Mieszana')
  })
})

describe('detectPlateau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsights = []
  })

  it('returns null when fewer than 3 sessions', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 32, '2025-01-08'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).toBeNull()
  })

  it('returns null when there is progress', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 32, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 35, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).toBeNull()
  })

  it('detects plateau when 3 sessions without progress', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).not.toBeNull()
    expect(result?.insight.type).toBe('plateau_warning')
    expect(result?.insight.tone).toBe('warning')
    expect(result?.insight.program).toBe('pushups')
    expect(result?.regression).toBe(false)
  })

  it('does not compare sessions across different cycles (no false plateau)', async () => {
    const harder: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01', 'cycle-easy'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08', 'cycle-easy'),
      // New harder cycle — lower numbers are expected, not a plateau
      makeSession('s3', 'pushups', 1, 18, '2025-01-15', 'cycle-hard'),
      makeSession('s4', 'pushups', 1, 19, '2025-01-22', 'cycle-hard'),
    ]
    const result = await detectPlateau('pushups', harder)
    expect(result).toBeNull()
  })

  it('detects plateau within a single cycle when same-day sessions stagnate', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01', 'cycle-hard'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08', 'cycle-hard'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15', 'cycle-hard'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).not.toBeNull()
  })

  it('marks strict decline as regression', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 28, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 25, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result?.regression).toBe(true)
    expect(result?.insight.body).toContain('spadł')
  })

  it('ignores all-zero runs (skipped/failed sessions are not stagnation)', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 0, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 0, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 0, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).toBeNull()
  })

  it('picks the day whose last session is most recent, not the highest day number', async () => {
    const sessions: LocalWorkoutSession[] = [
      // Day 5 plateaued long ago
      makeSession('a1', 'pushups', 5, 20, '2024-11-01'),
      makeSession('a2', 'pushups', 5, 20, '2024-11-08'),
      makeSession('a3', 'pushups', 5, 20, '2024-11-15'),
      // Day 1 plateaued recently — this is the one to report
      makeSession('b1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('b2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('b3', 'pushups', 1, 30, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).not.toBeNull()
    expect(result?.insight.body).toContain('30')
  })

  it('detects plateau for a custom plan via customPlanId scope', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeCustomSession('c1', 'plan-a', 1, 40, '2025-01-01'),
      makeCustomSession('c2', 'plan-a', 1, 40, '2025-01-08'),
      makeCustomSession('c3', 'plan-a', 1, 40, '2025-01-15'),
      // Different plan — must not interfere
      makeCustomSession('d1', 'plan-b', 1, 99, '2025-01-10'),
    ]
    const result = await detectPlateau('custom', sessions, {
      customPlanId: 'plan-a',
      programLabel: 'Mój plan',
    })
    expect(result).not.toBeNull()
    expect(result?.insight.customPlanId).toBe('plan-a')
    expect(result?.insight.body).toContain('Mój plan')
  })

  it('does not mix custom plans when scoping plateau', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeCustomSession('c1', 'plan-a', 1, 40, '2025-01-01'),
      makeCustomSession('c2', 'plan-a', 1, 42, '2025-01-08'),
      makeCustomSession('c3', 'plan-a', 1, 45, '2025-01-15'),
      // plan-b stagnates but must not trigger under plan-a scope
      makeCustomSession('d1', 'plan-b', 1, 20, '2025-01-01'),
      makeCustomSession('d2', 'plan-b', 1, 20, '2025-01-08'),
      makeCustomSession('d3', 'plan-b', 1, 20, '2025-01-15'),
    ]
    const result = await detectPlateau('custom', sessions, { customPlanId: 'plan-a' })
    expect(result).toBeNull()
    const forB = await detectPlateau('custom', sessions, { customPlanId: 'plan-b' })
    expect(forB).not.toBeNull()
  })

  it('is blocked by a recent undismissed warning (<7 days)', async () => {
    mockInsights = [
      {
        id: 'recent-warning',
        type: 'plateau_warning',
        program: 'pushups',
        title: 't',
        body: 'b',
        tone: 'warning',
        source: 'local',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15'),
    ]
    expect(await detectPlateau('pushups', sessions)).toBeNull()
  })

  it('re-warns weekly while the plateau persists (old undismissed warning does not block)', async () => {
    mockInsights = [
      {
        id: 'old-warning',
        type: 'plateau_warning',
        program: 'pushups',
        title: 't',
        body: 'b',
        tone: 'warning',
        source: 'local',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15'),
    ]
    expect(await detectPlateau('pushups', sessions)).not.toBeNull()
  })

  it('is blocked when an old warning was dismissed within the last 7 days', async () => {
    mockInsights = [
      {
        id: 'dismissed-warning',
        type: 'plateau_warning',
        program: 'pushups',
        title: 't',
        body: 'b',
        tone: 'warning',
        source: 'local',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        dismissedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15'),
    ]
    expect(await detectPlateau('pushups', sessions)).toBeNull()
  })

  it('fires again after a dismissed warning fully ages past 7 days', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    mockInsights = [
      {
        id: 'stale-warning',
        type: 'plateau_warning',
        program: 'pushups',
        title: 't',
        body: 'b',
        tone: 'warning',
        source: 'local',
        createdAt: old,
        dismissedAt: old,
      },
    ]
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 30, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 30, '2025-01-15'),
    ]
    expect(await detectPlateau('pushups', sessions)).not.toBeNull()
  })

  it('does not cross scopes — a warning for pushups does not block pullups', async () => {
    const recent = new Date().toISOString()
    mockInsights = [
      {
        id: 'other-program',
        type: 'plateau_warning',
        program: 'pushups',
        title: 't',
        body: 'b',
        tone: 'warning',
        source: 'local',
        createdAt: recent,
      },
    ]
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pullups', 1, 12, '2025-01-01'),
      makeSession('s2', 'pullups', 1, 12, '2025-01-08'),
      makeSession('s3', 'pullups', 1, 12, '2025-01-15'),
    ]
    expect(await detectPlateau('pullups', sessions)).not.toBeNull()
  })

  it('skips sessions with invalid dates', async () => {
    const bad = makeSession('bad', 'pushups', 1, 99, '2025-01-05')
    bad.startedAt = 'not-a-date'
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      bad,
      makeSession('s2', 'pushups', 1, 32, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 35, '2025-01-15'),
    ]
    // Without the invalid date, this is progression — no plateau
    expect(await detectPlateau('pushups', sessions)).toBeNull()
  })

  it('ignores zero-metric sessions inside a run instead of flagging regression', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 40, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 0, '2025-01-08'), // failed/skip — not plateau data
      makeSession('s3', 'pushups', 1, 0, '2025-01-15'),
      makeSession('s4', 'pushups', 1, 42, '2025-01-22'),
    ]
    // Filtering zeros leaves [40, 42] — only 2 sessions, no plateau
    expect(await detectPlateau('pushups', sessions)).toBeNull()
  })

  it('does not treat a 1-rep dip as regression', async () => {
    const sessions: LocalWorkoutSession[] = [
      makeSession('s1', 'pushups', 1, 30, '2025-01-01'),
      makeSession('s2', 'pushups', 1, 29, '2025-01-08'),
      makeSession('s3', 'pushups', 1, 29, '2025-01-15'),
    ]
    const result = await detectPlateau('pushups', sessions)
    expect(result).not.toBeNull()
    expect(result?.regression).toBe(false)
  })

  it('starts a fresh window when a custom plan day gets different exercises', async () => {
    const sessions: LocalWorkoutSession[] = [
      // Old exercise composition — stagnant
      makeCustomSession('c1', 'plan-a', 1, 40, '2025-01-01', ['bench']),
      makeCustomSession('c2', 'plan-a', 1, 40, '2025-01-08', ['bench']),
      // User swapped bench → row: volumes are not comparable
      makeCustomSession('c3', 'plan-a', 1, 30, '2025-01-15', ['row']),
      makeCustomSession('c4', 'plan-a', 1, 30, '2025-01-22', ['row']),
    ]
    // Neither signature has 3 sessions — no plateau
    expect(
      await detectPlateau('custom', sessions, { customPlanId: 'plan-a' }),
    ).toBeNull()
  })
})

describe('pruneOldAiInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsights = []
  })

  const makeInsight = (id: string, createdAt: string, dismissedAt?: string): LocalAiInsight => ({
    id,
    type: 'plateau_warning',
    title: 't',
    body: 'b',
    tone: 'warning',
    source: 'local',
    createdAt,
    dismissedAt,
  })

  it('does nothing when under the retention cap', async () => {
    mockInsights = [makeInsight('i1', '2025-01-01T00:00:00Z')]
    await pruneOldAiInsights()
    expect(mockInsights).toHaveLength(1)
    expect(enqueueSync).not.toHaveBeenCalled()
  })

  it('enqueues a sync delete for every pruned insight so deletions propagate', async () => {
    // 201 insights → the single oldest (dismissed first) is pruned
    mockInsights = [
      makeInsight('old-dismissed', '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'),
      ...Array.from({ length: 200 }, (_, i) =>
        makeInsight(`i${i}`, `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`),
      ),
    ]
    await pruneOldAiInsights()
    expect(mockInsights).toHaveLength(200)
    expect(mockInsights.find((i) => i.id === 'old-dismissed')).toBeUndefined()
    expect(enqueueSync).toHaveBeenCalledWith(
      'ai_insights',
      'delete',
      expect.objectContaining({ id: 'old-dismissed' }),
    )
  })
})

function makeSession(
  id: string,
  program: 'pushups' | 'pullups',
  dayNumber: number,
  totalReps: number,
  startedAt: string,
  cycleId = 'cycle-1',
): LocalWorkoutSession {
  return {
    id,
    program,
    cycleId,
    dayNumber,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: `${startedAt}T10:00:00Z`,
    completedAt: `${startedAt}T10:30:00Z`,
    passed: true,
    totalReps,
    setResults: [],
  }
}

function makeCustomSession(
  id: string,
  customPlanId: string,
  dayNumber: number,
  totalReps: number,
  startedAt: string,
  exerciseIds?: string[],
): LocalWorkoutSession {
  return {
    id,
    program: 'custom',
    programKind: 'custom',
    customPlanId,
    cycleId: 'custom-cycle',
    dayNumber,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: `${startedAt}T10:00:00Z`,
    completedAt: `${startedAt}T10:30:00Z`,
    passed: true,
    totalReps,
    setResults: [],
    exerciseLogs: exerciseIds?.map((exerciseId, order) => ({
      exerciseId,
      order,
      sets: [{ setNumber: 1, passed: true, actual: { reps: 10 }, prescription: {} }],
    })),
  }
}
