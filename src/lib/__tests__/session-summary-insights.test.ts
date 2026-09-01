import { describe, expect, it } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import {
  computeBuiltinSessionInsights,
  computeCustomSessionInsights,
} from '@/lib/session-summary-insights'

function builtinSession(
  partial: Partial<LocalWorkoutSession> & Pick<LocalWorkoutSession, 'id' | 'setResults'>,
): LocalWorkoutSession {
  return {
    program: 'pushups',
    cycleId: 'c1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2026-01-01T10:00:00.000Z',
    passed: true,
    totalReps: partial.setResults.reduce((sum, row) => sum + row.actual, 0),
    ...partial,
  }
}

describe('computeBuiltinSessionInsights', () => {
  it('marks set PR and session total PR when beating same-day history', () => {
    const current = builtinSession({
      id: 'cur',
      setResults: [
        { setNumber: 1, target: { kind: 'fixed', reps: 8 }, actual: 10, passed: true },
        { setNumber: 2, target: { kind: 'fixed', reps: 8 }, actual: 9, passed: true },
      ],
    })
    const previous = builtinSession({
      id: 'prev',
      setResults: [
        { setNumber: 1, target: { kind: 'fixed', reps: 8 }, actual: 8, passed: true },
        { setNumber: 2, target: { kind: 'fixed', reps: 8 }, actual: 8, passed: true },
      ],
    })
    const historical = [
      previous,
      builtinSession({
        id: 'old',
        setResults: [
          { setNumber: 1, target: { kind: 'fixed', reps: 8 }, actual: 9, passed: true },
          { setNumber: 2, target: { kind: 'fixed', reps: 8 }, actual: 8, passed: true },
        ],
      }),
    ]

    const result = computeBuiltinSessionInsights({
      current,
      previous,
      historicalSessions: historical,
    })

    expect(result.setInsights.get(1)?.kind).toBe('pr')
    expect(result.setInsights.get(2)?.kind).toBe('pr')
    expect(result.highlights.some((h) => h.id === 'session-total')).toBe(true)
    expect(result.prCount).toBeGreaterThan(0)
    expect(result.progressCount).toBe(0)
  })
})

describe('computeCustomSessionInsights', () => {
  it('marks exercise set PR and volume PR', () => {
    const bench: ExerciseDefinition = {
      id: 'bench',
      name: 'Wyciskanie',
      primaryMetric: 'reps_weight',
      restDefaultSec: 90,
      archived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    }
    const current: LocalWorkoutSession = {
      id: 'cur',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'p1',
      cycleId: 'p1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-02-01T10:00:00.000Z',
      passed: true,
      setResults: [],
      exerciseLogs: [
        {
          exerciseId: 'bench',
          order: 0,
          sets: [
            {
              setNumber: 1,
              passed: true,
              actual: { reps: 10, weightKg: 60 },
              prescription: {},
            },
          ],
        },
      ],
    }
    const historical: LocalWorkoutSession[] = [
      {
        ...current,
        id: 'old',
        exerciseLogs: [
          {
            exerciseId: 'bench',
            order: 0,
            sets: [
              {
                setNumber: 1,
                passed: true,
                actual: { reps: 8, weightKg: 55 },
                prescription: {},
              },
            ],
          },
        ],
      },
    ]

    const result = computeCustomSessionInsights({
      current,
      exerciseMap: new Map([['bench', bench]]),
      historicalSessions: historical,
    })

    expect(result.setInsights.get('bench:1')?.kind).toBe('pr')
    expect(result.highlights.some((h) => h.id === 'vol-pr-bench')).toBe(true)
  })
})
