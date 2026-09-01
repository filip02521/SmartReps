import { describe, expect, it } from 'vitest'
import {
  exercisePrDisplay,
  formatExerciseSetSummary,
  type ExerciseDetailStats,
} from '@/lib/custom-exercise-stats'
import { pl } from '@/i18n/pl'
import type { ExerciseDefinition, SetLog } from '@/lib/exercise-model'

const repsExercise: ExerciseDefinition = {
  id: 'ex1',
  name: 'Pompki',
  primaryMetric: 'reps',
  restDefaultSec: 90,
  archived: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function setLog(partial: Partial<SetLog> & Pick<SetLog, 'setNumber'>): SetLog {
  return {
    passed: true,
    prescription: { reps: { kind: 'fixed', value: 8 } },
    actual: { reps: 8 },
    ...partial,
  }
}

describe('custom-exercise-stats', () => {
  it('formatExerciseSetSummary for reps', () => {
    expect(formatExerciseSetSummary('reps', setLog({ setNumber: 1, actual: { reps: 12 } }))).toBe(
      `12 ${pl.repsUnit}`,
    )
  })

  it('formatExerciseSetSummary for duration', () => {
    expect(
      formatExerciseSetSummary(
        'duration_sec',
        setLog({ setNumber: 1, actual: { durationSec: 45 } }),
      ),
    ).toBe('45s')
  })

  it('formatExerciseSetSummary for reps+weight', () => {
    expect(
      formatExerciseSetSummary(
        'reps_weight',
        setLog({ setNumber: 1, actual: { reps: 10, weightKg: 20 } }),
      ),
    ).toBe('10 × 20 kg')
  })

  it('exercisePrDisplay picks metric-appropriate PR', () => {
    const base: Pick<
      ExerciseDetailStats,
      'exercise' | 'prReps' | 'prDurationSec' | 'prWeightKg' | 'prVolumeKg'
    > = {
      exercise: repsExercise,
      prReps: 15,
      prDurationSec: null,
      prWeightKg: null,
      prVolumeKg: null,
    }
    expect(exercisePrDisplay(base)).toBe(`15 ${pl.repsUnit}`)
  })
})
