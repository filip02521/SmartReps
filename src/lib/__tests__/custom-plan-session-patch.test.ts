import { describe, expect, it } from 'vitest'
import type { CustomPlan, ExerciseDefinition, ExerciseLog } from '@/lib/exercise-model'
import {
  addSetToPlanExercise,
  applyDayOverrideToPlan,
  applySessionLogsToPlanDay,
  buildSessionPlanChanges,
  canAddSetToExercise,
  canRemoveSetFromExercise,
  captureBaselineRests,
  captureBaselineSetCounts,
  removeSetFromPlanExercise,
  sessionDayIsDirty,
  sessionHasExtraSets,
  sessionSuggestsPlanUpdate,
  setLogToPrescription,
  setRestBetweenSetsOnExercise,
} from '@/lib/custom-plan-session-patch'

const plan: CustomPlan = {
  id: 'p1',
  name: 'Test',
  description: '',
  status: 'active',
  source: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  days: [
    {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'ex1',
          order: 0,
          restBetweenSetsSec: 90,
          sets: [
            { reps: { kind: 'fixed', value: 10 } },
            { reps: { kind: 'fixed', value: 10 } },
          ],
        },
      ],
    },
  ],
}

const exMap = new Map<string, ExerciseDefinition>([
  [
    'ex1',
    {
      id: 'ex1',
      name: 'Pompki',
      primaryMetric: 'reps',
      restDefaultSec: 90,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
])

describe('custom-plan-session-patch', () => {
  it('addSetToPlanExercise appends a cloned prescription', () => {
    const next = addSetToPlanExercise(plan, 1, 0)
    expect(next?.days[0]!.exercises[0]!.sets).toHaveLength(3)
    expect(canAddSetToExercise(plan.days[0]!, 0)).toBe(true)
    expect(sessionSuggestsPlanUpdate(plan, 1, [
      {
        exerciseId: 'ex1',
        order: 0,
        sets: [
          { setNumber: 1, passed: true, actual: { reps: 10 }, prescription: { reps: { kind: 'fixed', value: 10 } } },
          { setNumber: 2, passed: true, actual: { reps: 10 }, prescription: { reps: { kind: 'fixed', value: 10 } } },
          { setNumber: 3, passed: true, actual: { reps: 8 }, prescription: { reps: { kind: 'fixed', value: 10 } } },
        ],
      },
    ])).toBe(true)
  })

  it('applySessionLogsToPlanDay writes actuals as fixed targets when set count changes', () => {
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'ex1',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 12 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 2,
            passed: false,
            actual: { reps: 7 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 3,
            passed: true,
            actual: { reps: 9 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(plan, 1, logs, exMap)
    const sets = next.days[0]!.exercises[0]!.sets
    expect(sets).toHaveLength(3)
    expect(sets[0]).toEqual({ reps: { kind: 'fixed', value: 12 } })
    expect(sets[1]).toEqual({ reps: { kind: 'fixed', value: 7 } })
    expect(sets[2]).toEqual({ reps: { kind: 'fixed', value: 9 } })
  })

  it('setLogToPrescription handles duration and weight', () => {
    expect(
      setLogToPrescription(
        {
          setNumber: 1,
          passed: true,
          actual: { durationSec: 45 },
          prescription: { durationSec: { kind: 'fixed', value: 40 } },
        },
        'duration_sec',
      ),
    ).toEqual({ durationSec: { kind: 'fixed', value: 45 } })

    expect(
      setLogToPrescription(
        {
          setNumber: 1,
          passed: true,
          actual: { reps: 8, weightKg: 20 },
          prescription: { reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 20 } },
        },
        'reps_weight',
      ),
    ).toEqual({
      reps: { kind: 'fixed', value: 8 },
      weightKg: { kind: 'fixed', value: 20 },
    })
  })

  it('applyDayOverrideToPlan merges session day', () => {
    const withExtra = addSetToPlanExercise(plan, 1, 0)!
    const json = JSON.stringify(withExtra.days[0])
    const merged = applyDayOverrideToPlan(plan, json)
    expect(merged?.days[0]!.exercises[0]!.sets).toHaveLength(3)
  })

  it('removeSetFromPlanExercise drops trailing unlogged extras only', () => {
    const withExtra = addSetToPlanExercise(plan, 1, 0)!
    const baseline = captureBaselineSetCounts(plan.days[0]!)
    expect(baseline.ex1).toBe(2)
    expect(sessionHasExtraSets(withExtra.days[0]!, baseline)).toBe(true)
    expect(canRemoveSetFromExercise(withExtra.days[0]!, 0, 2, 2)).toBe(true)
    expect(canRemoveSetFromExercise(withExtra.days[0]!, 0, 2, 3)).toBe(true)
    expect(removeSetFromPlanExercise(withExtra, 1, 0, 2, 3)).toBeNull()
    const trimmed = removeSetFromPlanExercise(withExtra, 1, 0, 2, 2)
    expect(trimmed?.days[0]!.exercises[0]!.sets).toHaveLength(2)
    expect(canAddSetToExercise(plan.days[0]!, 0)).toBe(true)
  })

  it('setRestBetweenSetsOnExercise + rest-only patch does not rewrite targets', () => {
    const withRest = setRestBetweenSetsOnExercise(plan, 1, 0, 120)!
    expect(withRest.days[0]!.exercises[0]!.restBetweenSetsSec).toBe(120)
    const baselineSets = captureBaselineSetCounts(plan.days[0]!)
    const baselineRests = captureBaselineRests(plan.days[0]!)
    expect(sessionDayIsDirty(withRest.days[0]!, baselineSets, baselineRests)).toBe(true)
    expect(sessionSuggestsPlanUpdate(plan, 1, [], withRest.days[0]!)).toBe(true)
    expect(buildSessionPlanChanges(plan, 1, [], withRest.days[0]!)).toEqual([
      { kind: 'rest', exerciseId: 'ex1', from: 90, to: 120 },
    ])

    const logs: ExerciseLog[] = [
      {
        exerciseId: 'ex1',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 99 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 2,
            passed: true,
            actual: { reps: 99 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(plan, 1, logs, exMap, withRest.days[0]!)
    expect(next.days[0]!.exercises[0]!.restBetweenSetsSec).toBe(120)
    expect(next.days[0]!.exercises[0]!.sets[0]).toEqual({
      reps: { kind: 'fixed', value: 10 },
    })
  })

  it('applySessionLogsToPlanDay rewrites only exercises whose set count changed', () => {
    const multi: CustomPlan = {
      ...plan,
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [
            {
              exerciseId: 'ex1',
              order: 0,
              restBetweenSetsSec: 90,
              sets: [
                { reps: { kind: 'fixed', value: 10 } },
                { reps: { kind: 'fixed', value: 10 } },
              ],
            },
            {
              exerciseId: 'ex2',
              order: 1,
              restBetweenSetsSec: 60,
              sets: [{ reps: { kind: 'fixed', value: 8 } }],
            },
          ],
        },
      ],
    }
    const map = new Map(exMap)
    map.set('ex2', {
      id: 'ex2',
      name: 'Przysiady',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'ex1',
        order: 0,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 12 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 2,
            passed: true,
            actual: { reps: 11 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 3,
            passed: true,
            actual: { reps: 9 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
        ],
      },
      {
        exerciseId: 'ex2',
        order: 1,
        sets: [
          {
            setNumber: 1,
            passed: true,
            actual: { reps: 99 },
            prescription: { reps: { kind: 'fixed', value: 8 } },
          },
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(multi, 1, logs, map)
    expect(next.days[0]!.exercises[0]!.sets).toHaveLength(3)
    expect(next.days[0]!.exercises[0]!.sets[0]).toEqual({ reps: { kind: 'fixed', value: 12 } })
    // Unchanged set count → keep original targets (not session actuals).
    expect(next.days[0]!.exercises[1]!.sets).toEqual([{ reps: { kind: 'fixed', value: 8 } }])
  })
})
