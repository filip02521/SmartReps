import { describe, expect, it } from 'vitest'
import {
  countSessionLoggedSets,
  shouldPreferLocalSession,
} from '@/lib/session-sync-merge'
import type { LocalWorkoutSession } from '@/lib/db'

function baseLocal(partial: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'c1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: '2026-01-01T10:00:00.000Z',
    setResults: [],
    ...partial,
  }
}

describe('countSessionLoggedSets', () => {
  it('counts builtin setResults with actual reps', () => {
    expect(countSessionLoggedSets({ setResults: [{ actual: 10 }, { actual: 0 }] })).toBe(2)
  })

  it('counts custom exerciseLogs with passed or actual values', () => {
    expect(
      countSessionLoggedSets({
        exerciseLogs: [
          {
            sets: [
              {
                setNumber: 1,
                passed: true,
                actual: { reps: 8 },
                prescription: { reps: { kind: 'fixed', value: 8 } },
              },
              {
                setNumber: 2,
                passed: false,
                actual: {},
                prescription: { reps: { kind: 'fixed', value: 8 } },
              },
            ],
          },
        ],
      }),
    ).toBe(1)
  })
})

describe('shouldPreferLocalSession', () => {
  it('prefers local in_progress when it has more logged sets', () => {
    const local = baseLocal({
      setResults: [
        { actual: 10, setNumber: 1, target: { kind: 'fixed', reps: 10 }, passed: true },
        { actual: 10, setNumber: 2, target: { kind: 'fixed', reps: 10 }, passed: true },
      ],
    })
    expect(
      shouldPreferLocalSession(local, {
        status: 'in_progress',
        started_at: local.startedAt,
        completed_at: null,
        setResults: [{ actual: 10 }],
      }),
    ).toBe(true)
  })

  it('keeps local on equal in_progress progress (avoid wipe)', () => {
    const local = baseLocal({
      setResults: [{ actual: 10, setNumber: 1, target: { kind: 'fixed', reps: 10 }, passed: true }],
    })
    expect(
      shouldPreferLocalSession(local, {
        status: 'in_progress',
        started_at: local.startedAt,
        completed_at: null,
        setResults: [{ actual: 10 }],
      }),
    ).toBe(true)
  })

  it('prefers remote in_progress when it has more logged sets', () => {
    const local = baseLocal({
      setResults: [{ actual: 10, setNumber: 1, target: { kind: 'fixed', reps: 10 }, passed: true }],
    })
    expect(
      shouldPreferLocalSession(local, {
        status: 'in_progress',
        started_at: local.startedAt,
        completed_at: null,
        setResults: [
          { actual: 10 },
          { actual: 10 },
          { actual: 8 },
        ],
      }),
    ).toBe(false)
  })

  it('prefers remote completed over local in_progress', () => {
    const local = baseLocal({
      setResults: [{ actual: 10, setNumber: 1, target: { kind: 'fixed', reps: 10 }, passed: true }],
    })
    expect(
      shouldPreferLocalSession(local, {
        status: 'completed',
        started_at: local.startedAt,
        completed_at: '2026-01-01T11:00:00.000Z',
        setResults: [],
      }),
    ).toBe(false)
  })
})
