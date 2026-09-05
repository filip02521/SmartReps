import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSmartRestSuggestion, generatePostWorkoutInsight, detectPlateau } from '../ai/proactive-coach'
import type { LocalWorkoutSession } from '@/lib/db'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    aiInsights: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(undefined)),
          })),
        })),
      })),
    },
  },
}))

// Mock session-summary-insights
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
}))

// Mock AI client
vi.mock('@/lib/ai/ai-client', () => ({
  chatCompletion: vi.fn(),
  parseJsonResponse: vi.fn(),
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

// Mock custom-session-utils
vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: vi.fn(() => false),
}))

describe('getSmartRestSuggestion', () => {
  it('returns firstTime message when no previous actual', () => {
    const result = getSmartRestSuggestion(undefined, 10)
    expect(result).toBeTruthy()
    expect(result).toContain('Pierwszy raz')
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
})

describe('detectPlateau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(result?.type).toBe('plateau_warning')
    expect(result?.tone).toBe('warning')
    expect(result?.program).toBe('pushups')
  })
})

function makeSession(
  id: string,
  program: 'pushups' | 'pullups',
  dayNumber: number,
  totalReps: number,
  startedAt: string,
): LocalWorkoutSession {
  return {
    id,
    program,
    cycleId: 'cycle-1',
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
