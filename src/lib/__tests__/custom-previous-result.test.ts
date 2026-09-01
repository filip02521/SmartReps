import { describe, expect, it } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import {
  formatPreviousCustomContext,
  formatPreviousCustomValue,
  pickPreviousCustomSet,
  toPreviousCustomSetResult,
} from '@/lib/custom-previous-result'

function session(partial: Partial<LocalWorkoutSession> & Pick<LocalWorkoutSession, 'id'>): LocalWorkoutSession {
  return {
    id: partial.id,
    program: 'custom',
    programKind: 'custom',
    customPlanId: partial.customPlanId ?? 'plan-1',
    cycleId: partial.customPlanId ?? 'plan-1',
    dayNumber: partial.dayNumber ?? 1,
    cycleAttempt: partial.cycleAttempt ?? 1,
    status: partial.status ?? 'completed',
    startedAt: partial.startedAt ?? '2026-01-01T10:00:00.000Z',
    completedAt: partial.completedAt ?? '2026-01-01T10:30:00.000Z',
    passed: partial.passed ?? true,
    setResults: [],
    exerciseLogs: partial.exerciseLogs ?? [],
  }
}

describe('pickPreviousCustomSet', () => {
  it('returns most recent set across any day', () => {
    const sessions = [
      session({
        id: 'old',
        dayNumber: 1,
        cycleAttempt: 1,
        completedAt: '2026-01-01T10:00:00.000Z',
        exerciseLogs: [
          {
            exerciseId: 'bench',
            order: 0,
            sets: [{ setNumber: 1, passed: true, actual: { reps: 8 }, prescription: {} }],
          },
        ],
      }),
      session({
        id: 'new',
        dayNumber: 3,
        cycleAttempt: 1,
        completedAt: '2026-01-05T10:00:00.000Z',
        exerciseLogs: [
          {
            exerciseId: 'bench',
            order: 0,
            sets: [{ setNumber: 1, passed: true, actual: { reps: 10, weightKg: 60 }, prescription: {} }],
          },
        ],
      }),
    ]

    const picked = pickPreviousCustomSet(sessions, {
      customPlanId: 'plan-1',
      exerciseId: 'bench',
      setNumber: 1,
    })

    expect(picked?.session.id).toBe('new')
    expect(picked?.set.actual.reps).toBe(10)
  })

  it('excludes current in-progress session', () => {
    const sessions = [
      session({
        id: 'current',
        status: 'in_progress',
        exerciseLogs: [
          {
            exerciseId: 'sq',
            order: 0,
            sets: [{ setNumber: 1, passed: true, actual: { reps: 99 }, prescription: {} }],
          },
        ],
      }),
      session({
        id: 'prev',
        dayNumber: 2,
        exerciseLogs: [
          {
            exerciseId: 'sq',
            order: 0,
            sets: [{ setNumber: 1, passed: true, actual: { reps: 12 }, prescription: {} }],
          },
        ],
      }),
    ]

    const picked = pickPreviousCustomSet(sessions, {
      customPlanId: 'plan-1',
      exerciseId: 'sq',
      setNumber: 1,
      excludeSessionId: 'current',
    })

    expect(picked?.session.id).toBe('prev')
  })

  it('includes failed completed sessions', () => {
    const sessions = [
      session({
        id: 'fail',
        passed: false,
        exerciseLogs: [
          {
            exerciseId: 'pull',
            order: 0,
            sets: [{ setNumber: 2, passed: false, actual: { reps: 4 }, prescription: {} }],
          },
        ],
      }),
    ]

    const picked = pickPreviousCustomSet(sessions, {
      customPlanId: 'plan-1',
      exerciseId: 'pull',
      setNumber: 2,
    })

    expect(picked?.set.actual.reps).toBe(4)
  })
})

describe('formatPreviousCustomContext', () => {
  it('shows day when from different day', () => {
    const result = toPreviousCustomSetResult(
      session({ id: 's', dayNumber: 2, cycleAttempt: 1 }),
      { setNumber: 1, passed: true, actual: { reps: 5 }, prescription: {} },
    )
    expect(formatPreviousCustomContext(result, 3, 1)).toBe('D2')
  })

  it('shows attempt when same day different cycle', () => {
    const result = toPreviousCustomSetResult(
      session({ id: 's', dayNumber: 1, cycleAttempt: 1 }),
      { setNumber: 1, passed: true, actual: { reps: 5 }, prescription: {} },
    )
    expect(formatPreviousCustomContext(result, 1, 2)).toBe('Próba 1')
  })

  it('omits context when same day and attempt', () => {
    const result = toPreviousCustomSetResult(
      session({ id: 's', dayNumber: 1, cycleAttempt: 2 }),
      { setNumber: 1, passed: true, actual: { reps: 5 }, prescription: {} },
    )
    expect(formatPreviousCustomContext(result, 1, 2)).toBeNull()
  })
})

describe('formatPreviousCustomValue', () => {
  it('formats reps+weight', () => {
    const result = toPreviousCustomSetResult(
      session({ id: 's' }),
      {
        setNumber: 1,
        passed: true,
        actual: { reps: 8, weightKg: 20 },
        prescription: {},
      },
    )
    expect(formatPreviousCustomValue(result, 'reps_weight')).toBe('8 × 20 kg')
  })
})
