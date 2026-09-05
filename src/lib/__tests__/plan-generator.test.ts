import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    exercises: {
      get: vi.fn(() => Promise.resolve(undefined)),
    },
  },
}))

// Mock custom-plan-service
vi.mock('@/lib/custom-plan-service', () => ({
  saveExercise: vi.fn(),
  saveCustomPlan: vi.fn((_plan: unknown) => Promise.resolve(_plan)),
  listExercises: vi.fn(() => Promise.resolve([])),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'test-id-' + Math.random().toString(36).slice(2)),
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
  buildPlanGenerationPrompt: vi.fn(() => ({
    system: { role: 'system', content: 'sys' },
    user: { role: 'user', content: 'usr' },
  })),
}))

import { generatePlan } from '../ai/plan-generator'
import { chatCompletion, parseJsonResponse } from '@/lib/ai/ai-client'

describe('generatePlan — defensive checks for malformed AI response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chatCompletion).mockResolvedValue({
      content: '{}',
      usage: { promptTokens: 0, completionTokens: 0 },
    })
  })

  it('throws parse error when plan is missing', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue(null)

    await expect(
      generatePlan(
        { description: 'test', daysPerWeek: 3, experienceLevel: 'beginner', equipment: 'dumbbells', goal: 'hypertrophy' },
        { apiKey: 'k', model: 'm', library: [] },
      ),
    ).rejects.toThrow()
  })

  it('throws parse error when days array is empty', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: { name: 'Test', description: 'Desc', days: [] },
    } as never)

    await expect(
      generatePlan(
        { description: 'test', daysPerWeek: 3, experienceLevel: 'beginner', equipment: 'dumbbells', goal: 'hypertrophy' },
        { apiKey: 'k', model: 'm', library: [] },
      ),
    ).rejects.toThrow()
  })

  it('handles missing plan name gracefully (uses fallback)', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: {
        // name missing
        description: 'Desc',
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            exercises: [
              {
                exerciseName: 'Push-up',
                primaryMetric: 'reps',
                sets: [{ reps: { kind: 'fixed', value: 10 } }],
                restBetweenSetsSec: 60,
              },
            ],
          },
        ],
      },
    } as never)

    const result = await generatePlan(
      { description: 'test', daysPerWeek: 1, experienceLevel: 'beginner', equipment: 'bodyweight', goal: 'hypertrophy' },
      { apiKey: 'k', model: 'm', library: [] },
    )
    // Should use fallback name, not crash
    expect(result.plan.name).toBeTruthy()
    expect(result.plan.name.length).toBeGreaterThan(0)
  })

  it('handles missing description gracefully', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: {
        name: 'Test Plan',
        // description missing
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            exercises: [],
          },
        ],
      },
    } as never)

    const result = await generatePlan(
      { description: 'test', daysPerWeek: 1, experienceLevel: 'beginner', equipment: 'bodyweight', goal: 'hypertrophy' },
      { apiKey: 'k', model: 'm', library: [] },
    )
    expect(result.plan.description).toBe('')
  })

  it('handles missing exerciseName gracefully (skips exercise)', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: {
        name: 'Test',
        description: 'Desc',
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            exercises: [
              {
                // exerciseName missing
                primaryMetric: 'reps',
                sets: [{ reps: { kind: 'fixed', value: 10 } }],
                restBetweenSetsSec: 60,
              },
              {
                exerciseName: 'Squat',
                primaryMetric: 'reps',
                sets: [{ reps: { kind: 'fixed', value: 15 } }],
                restBetweenSetsSec: 90,
              },
            ],
          },
        ],
      },
    } as never)

    const result = await generatePlan(
      { description: 'test', daysPerWeek: 1, experienceLevel: 'beginner', equipment: 'bodyweight', goal: 'hypertrophy' },
      { apiKey: 'k', model: 'm', library: [] },
    )
    // Only the exercise with a name should be included
    expect(result.plan.days[0].exercises).toHaveLength(1)
  })

  it('handles missing sets array gracefully (uses fallback sets)', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: {
        name: 'Test',
        description: 'Desc',
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            exercises: [
              {
                exerciseName: 'Push-up',
                primaryMetric: 'reps',
                // sets missing
                restBetweenSetsSec: 60,
              },
            ],
          },
        ],
      },
    } as never)

    const result = await generatePlan(
      { description: 'test', daysPerWeek: 1, experienceLevel: 'beginner', equipment: 'bodyweight', goal: 'hypertrophy' },
      { apiKey: 'k', model: 'm', library: [] },
    )
    // Should have fallback sets (1 set with 8 reps for reps metric)
    expect(result.plan.days[0].exercises).toHaveLength(1)
    expect(result.plan.days[0].exercises[0].sets.length).toBeGreaterThan(0)
  })

  it('handles missing exercises array in day gracefully', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      plan: {
        name: 'Test',
        description: 'Desc',
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            // exercises missing
          },
        ],
      },
    } as never)

    const result = await generatePlan(
      { description: 'test', daysPerWeek: 1, experienceLevel: 'beginner', equipment: 'bodyweight', goal: 'hypertrophy' },
      { apiKey: 'k', model: 'm', library: [] },
    )
    expect(result.plan.days[0].exercises).toEqual([])
  })
})
