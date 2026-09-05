import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      filter: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    },
  },
}))

// Mock AI client
vi.mock('@/lib/ai/ai-client', () => ({
  chatCompletion: vi.fn(),
  parseJsonResponse: vi.fn(),
  canDisableReasoning: () => false,
  resolveReasoningEffort: () => undefined,
  AiApiError: class extends Error {
    kind?: string
    constructor(msg: string, _status: number | undefined, kind: string) {
      super(msg)
      this.kind = kind
    }
  },
}))

// Mock prompts
vi.mock('@/lib/ai/prompts', () => ({
  buildWorkoutAnalysisPrompt: vi.fn(() => ({
    system: { role: 'system', content: 'sys' },
    user: { role: 'user', content: 'usr' },
  })),
}))

// Mock custom-session-utils
vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: vi.fn(() => false),
}))

// Mock listExercises
vi.mock('@/lib/custom-plan-service', () => ({
  listExercises: vi.fn(() => Promise.resolve([])),
}))

import { analyzeWorkouts } from '../ai/workout-analyzer'
import { chatCompletion, parseJsonResponse } from '@/lib/ai/ai-client'

describe('analyzeWorkouts — defensive checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chatCompletion).mockResolvedValue({
      content: '{}',
      usage: { promptTokens: 0, completionTokens: 0 },
    })
  })

  it('throws parse error when analysis is missing', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue(null)

    await expect(
      analyzeWorkouts({ apiKey: 'k', model: 'm', exercises: [] }),
    ).rejects.toThrow()
  })

  it('fills missing arrays with empty arrays (no crash)', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      analysis: {
        summary: 'Test summary',
        // strengths, weaknesses, suggestions, volumeAssessment all missing
      },
    } as never)

    const result = await analyzeWorkouts({ apiKey: 'k', model: 'm', exercises: [] })
    expect(result.strengths).toEqual([])
    expect(result.weaknesses).toEqual([])
    expect(result.suggestions).toEqual([])
    expect(result.volumeAssessment).toEqual([])
    expect(result.summary).toBe('Test summary')
  })

  it('fills missing summary with empty string', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      analysis: {
        strengths: ['Good'],
        weaknesses: [],
        suggestions: [],
        volumeAssessment: [],
        // summary missing
      },
    } as never)

    const result = await analyzeWorkouts({ apiKey: 'k', model: 'm', exercises: [] })
    expect(result.summary).toBe('')
    expect(result.strengths).toEqual(['Good'])
  })

  it('preserves all arrays when present', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      analysis: {
        summary: 'Full',
        strengths: ['S1', 'S2'],
        weaknesses: ['W1'],
        suggestions: [{ title: 'T', description: 'D', priority: 'high' as const }],
        volumeAssessment: [
          { muscleGroup: 'chest', weeklySets: 10, status: 'optimal' as const, recommendation: 'OK' },
        ],
      },
    } as never)

    const result = await analyzeWorkouts({ apiKey: 'k', model: 'm', exercises: [] })
    expect(result.summary).toBe('Full')
    expect(result.strengths).toHaveLength(2)
    expect(result.weaknesses).toHaveLength(1)
    expect(result.suggestions).toHaveLength(1)
    expect(result.volumeAssessment).toHaveLength(1)
  })
})
