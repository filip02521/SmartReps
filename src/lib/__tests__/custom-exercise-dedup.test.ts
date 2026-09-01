import { describe, expect, it } from 'vitest'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import {
  buildExerciseReferenceCounts,
  exerciseDedupKey,
  groupExerciseDuplicates,
  normalizeExerciseName,
  pickCanonicalExercise,
} from '@/lib/custom-exercise-dedup'

function exercise(
  partial: Partial<ExerciseDefinition> & Pick<ExerciseDefinition, 'id' | 'name'>,
): ExerciseDefinition {
  return {
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('normalizeExerciseName', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeExerciseName('  PomPki  ')).toBe('pompki')
    expect(normalizeExerciseName('Deska   boczna')).toBe('deska boczna')
  })
})

describe('groupExerciseDuplicates', () => {
  it('groups active exercises by normalized name and metric', () => {
    const exercises = [
      exercise({ id: 'a', name: 'Pompki' }),
      exercise({ id: 'b', name: ' pompki ' }),
      exercise({ id: 'c', name: 'Pompki', primaryMetric: 'duration_sec' }),
      exercise({ id: 'd', name: 'Przysiady' }),
    ]
    const groups = groupExerciseDuplicates(exercises)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.map((ex) => ex.id).sort()).toEqual(['a', 'b'])
  })

  it('ignores archived rows', () => {
    const exercises = [
      exercise({ id: 'a', name: 'Pompki' }),
      exercise({ id: 'b', name: 'Pompki', archived: true }),
    ]
    expect(groupExerciseDuplicates(exercises)).toHaveLength(0)
  })
})

describe('pickCanonicalExercise', () => {
  it('prefers the exercise with more references', () => {
    const group = [
      exercise({ id: 'old', name: 'Pompki', createdAt: '2025-01-01T00:00:00.000Z' }),
      exercise({ id: 'used', name: 'Pompki', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const refs = new Map([
      ['old', 1],
      ['used', 4],
    ])
    expect(pickCanonicalExercise(group, refs).id).toBe('used')
  })

  it('falls back to oldest createdAt when references tie', () => {
    const group = [
      exercise({ id: 'b', name: 'Pompki', createdAt: '2026-02-01T00:00:00.000Z' }),
      exercise({ id: 'a', name: 'Pompki', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(pickCanonicalExercise(group, new Map()).id).toBe('a')
  })
})

describe('buildExerciseReferenceCounts', () => {
  it('counts plan, session and active workout references', () => {
    const counts = buildExerciseReferenceCounts(
      [
        {
          id: 'plan',
          name: 'P',
          description: '',
          status: 'active',
          days: [{ dayNumber: 1, restAfterDay: 1, exercises: [{ exerciseId: 'a', order: 0, sets: [], restBetweenSetsSec: 90 }] }],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          source: 'user',
        },
      ],
      [
        {
          id: 's1',
          program: 'custom',
          cycleId: 'c',
          dayNumber: 1,
          cycleAttempt: 1,
          status: 'completed',
          startedAt: '2026-01-01',
          setResults: [],
          exerciseLogs: [{ exerciseId: 'a', order: 0, sets: [] }],
        },
      ],
      [
        {
          customPlanId: 'plan',
          sessionId: 's2',
          currentExerciseIndex: 0,
          currentSetIndex: 0,
          exerciseLogs: [{ exerciseId: 'b', order: 0, sets: [] }],
          restTimerJson: null,
          updatedAt: '2026-01-01',
        },
      ],
    )
    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
  })
})

describe('exerciseDedupKey', () => {
  it('combines normalized name and metric', () => {
    expect(exerciseDedupKey(' Pompki ', 'reps')).toBe(`${normalizeExerciseName('Pompki')}\0reps`)
  })
})
