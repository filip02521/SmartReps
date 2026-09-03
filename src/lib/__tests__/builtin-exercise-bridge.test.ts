import { describe, expect, it } from 'vitest'
import {
  builtinProgramLabel,
  builtinSessionToExerciseLog,
  isCompletedBuiltinProgramSession,
  resolveBuiltinProgramForExercise,
} from '@/lib/builtin-exercise-bridge'
import { collectExerciseSessionLogs } from '@/lib/custom-exercise-stats'
import { pl } from '@/i18n/pl'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'

const pompki: ExerciseDefinition = {
  id: 'lib-pushups-uuid',
  name: pl.exerciseStarterPushups,
  primaryMetric: 'reps',
  restDefaultSec: 90,
  archived: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const squats: ExerciseDefinition = {
  id: 'lib-squats-uuid',
  name: pl.exerciseStarterSquats,
  primaryMetric: 'reps',
  restDefaultSec: 90,
  archived: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function builtinSession(partial: Partial<LocalWorkoutSession> = {}): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'c1',
    dayNumber: 3,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2026-02-01T10:00:00.000Z',
    completedAt: '2026-02-01T10:20:00.000Z',
    passed: true,
    setResults: [
      { setNumber: 1, target: { kind: 'fixed', reps: 10 }, actual: 12, passed: true },
      { setNumber: 2, target: { kind: 'fixed', reps: 10 }, actual: 11, passed: true },
    ],
    ...partial,
  }
}

describe('builtin-exercise-bridge', () => {
  it('maps starter Pompki/Podciąganie to programs', () => {
    expect(resolveBuiltinProgramForExercise(pompki)).toBe('pushups')
    expect(
      resolveBuiltinProgramForExercise({
        name: pl.exerciseStarterPullups,
        primaryMetric: 'reps',
      }),
    ).toBe('pullups')
    expect(resolveBuiltinProgramForExercise(squats)).toBeNull()
    expect(
      resolveBuiltinProgramForExercise({
        name: pl.exerciseStarterPushups,
        primaryMetric: 'duration_sec',
      }),
    ).toBeNull()
  })

  it('converts builtin setResults into exercise logs', () => {
    const log = builtinSessionToExerciseLog(builtinSession(), pompki.id)
    expect(log?.sets).toHaveLength(2)
    expect(log?.sets[0]?.actual.reps).toBe(12)
    expect(log?.sets[0]?.passed).toBe(true)
  })

  it('detects completed builtin program sessions', () => {
    expect(isCompletedBuiltinProgramSession(builtinSession())).toBe(true)
    expect(
      isCompletedBuiltinProgramSession(
        builtinSession({ program: 'custom', programKind: 'custom', exerciseLogs: [] }),
      ),
    ).toBe(false)
  })

  it('collectExerciseSessionLogs merges builtin history for Pompki', () => {
    const sessions: LocalWorkoutSession[] = [
      builtinSession(),
      {
        id: 'custom-1',
        program: 'custom',
        programKind: 'custom',
        customPlanId: 'plan-1',
        cycleId: 'plan-1',
        dayNumber: 1,
        cycleAttempt: 1,
        status: 'completed',
        startedAt: '2026-02-02T10:00:00.000Z',
        completedAt: '2026-02-02T10:30:00.000Z',
        setResults: [],
        exerciseLogs: [
          {
            exerciseId: pompki.id,
            order: 0,
            sets: [
              {
                setNumber: 1,
                passed: true,
                actual: { reps: 15 },
                prescription: { reps: { kind: 'fixed', value: 12 } },
              },
            ],
          },
        ],
      },
    ]

    const rows = collectExerciseSessionLogs(sessions, pompki)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.session.id)).toEqual(['s1', 'custom-1'])
    expect(rows[0]!.planName).toBe(builtinProgramLabel('pushups'))

    expect(collectExerciseSessionLogs(sessions, squats)).toHaveLength(0)
  })
})
