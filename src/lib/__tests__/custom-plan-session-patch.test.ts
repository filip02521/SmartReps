import { describe, expect, it } from 'vitest'
import type { CustomPlan, ExerciseDefinition, ExerciseLog, PlanDay, SetLog } from '@/lib/exercise-model'
import {
  addExerciseToSessionDay,
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
  sessionHasExerciseSwaps,
  sessionHasExtraSets,
  sessionSuggestsPlanUpdate,
  setLogToPrescription,
  setRestBetweenSetsOnExercise,
  swapExerciseInSessionDay,
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
            actual: { reps: 10 },
            prescription: { reps: { kind: 'fixed', value: 10 } },
          },
          {
            setNumber: 2,
            passed: true,
            actual: { reps: 10 },
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
            actual: { reps: 8 },
            prescription: { reps: { kind: 'fixed', value: 8 } },
          },
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(multi, 1, logs, map)
    expect(next.days[0]!.exercises[0]!.sets).toHaveLength(3)
    expect(next.days[0]!.exercises[0]!.sets[0]).toEqual({ reps: { kind: 'fixed', value: 12 } })
    // Unchanged set count + matching values → keep original targets.
    expect(next.days[0]!.exercises[1]!.sets).toEqual([{ reps: { kind: 'fixed', value: 8 } }])
  })

  it('applySessionLogsToPlanDay rewrites targets when values differ (same set count)', () => {
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
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(plan, 1, logs, exMap)
    // Same set count but values differ → rewrite targets from logs.
    expect(next.days[0]!.exercises[0]!.sets).toEqual([
      { reps: { kind: 'fixed', value: 12 } },
      { reps: { kind: 'fixed', value: 11 } },
    ])
  })

  it('buildSessionPlanChanges detects target_values when reps differ', () => {
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
        ],
      },
    ]
    const changes = buildSessionPlanChanges(plan, 1, logs, null, exMap)
    const targetChange = changes.find((c) => c.kind === 'target_values')
    expect(targetChange).toBeDefined()
    if (targetChange && targetChange.kind === 'target_values') {
      expect(targetChange.changes).toHaveLength(2)
      expect(targetChange.changes[0]!.setNumber).toBe(1)
      expect(targetChange.changes[0]!.fromReps).toBe(10)
      expect(targetChange.changes[0]!.toReps).toBe(12)
    }
  })

  // ── Exercise add ──

  it('addExerciseToSessionDay appends a new exercise at the end', () => {
    const newDef: ExerciseDefinition = {
      id: 'ex3',
      name: 'Przysiady',
      primaryMetric: 'reps',
      restDefaultSec: 60,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const next = addExerciseToSessionDay(plan, 1, 'ex3', newDef)
    expect(next).not.toBeNull()
    expect(next!.days[0]!.exercises).toHaveLength(2)
    expect(next!.days[0]!.exercises[1]!.exerciseId).toBe('ex3')
    expect(next!.days[0]!.exercises[1]!.order).toBe(1)
    expect(next!.days[0]!.exercises[1]!.sets).toEqual([{ reps: { kind: 'fixed', value: 8 } }])
  })

  it('buildSessionPlanChanges detects exercise_added from session day', () => {
    const sessionDay: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        ...plan.days[0]!.exercises,
        {
          exerciseId: 'ex3',
          order: 1,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 8 } }],
        },
      ],
    }
    const changes = buildSessionPlanChanges(plan, 1, [], sessionDay)
    expect(changes.some((c) => c.kind === 'exercise_added' && c.exerciseId === 'ex3')).toBe(true)
  })

  it('applySessionLogsToPlanDay appends added exercises from session day', () => {
    const sessionDay: PlanDay = {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        ...plan.days[0]!.exercises,
        {
          exerciseId: 'ex3',
          order: 1,
          restBetweenSetsSec: 60,
          sets: [{ reps: { kind: 'fixed', value: 12 } }],
        },
      ],
    }
    const logs: ExerciseLog[] = [
      { exerciseId: 'ex1', order: 0, sets: [] },
      { exerciseId: 'ex3', order: 1, sets: [{ setNumber: 1, passed: true, actual: { reps: 12 }, prescription: { reps: { kind: 'fixed', value: 8 } } }] },
    ]
    const exMapWithEx3 = new Map(exMap)
    exMapWithEx3.set('ex3', { id: 'ex3', name: 'Przysiady', primaryMetric: 'reps', restDefaultSec: 60, archived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
    const next = applySessionLogsToPlanDay(plan, 1, logs, exMapWithEx3, sessionDay)
    expect(next.days[0]!.exercises).toHaveLength(2)
    expect(next.days[0]!.exercises[1]!.exerciseId).toBe('ex3')
    expect(next.days[0]!.exercises[1]!.sets).toEqual([{ reps: { kind: 'fixed', value: 12 } }])
  })

  // ── Exercise swap ──

  const ex2Def: ExerciseDefinition = {
    id: 'ex2',
    name: 'Deska',
    primaryMetric: 'duration_sec',
    restDefaultSec: 60,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('swapExerciseInSessionDay changes exerciseId and resets sets for new metric', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)
    expect(swapped).not.toBeNull()
    const pe = swapped!.days[0]!.exercises[0]!
    expect(pe.exerciseId).toBe('ex2')
    expect(pe.sets).toEqual([{ durationSec: { kind: 'min', value: 30 } }])
    expect(pe.restBetweenSetsSec).toBe(60)
  })

  it('swapExerciseInSessionDay prefills sets from history when provided', () => {
    const historySets: SetLog[] = [
      { setNumber: 1, passed: true, actual: { durationSec: 45 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
      { setNumber: 2, passed: true, actual: { durationSec: 40 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
      { setNumber: 3, passed: true, actual: { durationSec: 50 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
    ]
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def, historySets)
    expect(swapped).not.toBeNull()
    const pe = swapped!.days[0]!.exercises[0]!
    expect(pe.exerciseId).toBe('ex2')
    expect(pe.sets).toHaveLength(3)
    expect(pe.sets[0]).toEqual({ durationSec: { kind: 'fixed', value: 45 } })
    expect(pe.sets[2]).toEqual({ durationSec: { kind: 'fixed', value: 50 } })
  })

  it('swapExerciseInSessionDay is no-op for same exercise', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex1', exMap.get('ex1')!)
    expect(swapped).toBe(plan)
  })

  it('swapExerciseInSessionDay returns null for grouped exercises', () => {
    const grouped: CustomPlan = {
      ...plan,
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          groups: [{ id: 'g1', kind: 'superset' }],
          exercises: [
            { exerciseId: 'ex1', order: 0, restBetweenSetsSec: 90, sets: [{ reps: { kind: 'fixed', value: 10 } }], groupId: 'g1' },
            { exerciseId: 'ex2', order: 1, restBetweenSetsSec: 60, sets: [{ reps: { kind: 'fixed', value: 8 } }], groupId: 'g1' },
          ],
        },
      ],
    }
    expect(swapExerciseInSessionDay(grouped, 1, 0, 'ex2', ex2Def)).toBeNull()
  })

  it('sessionHasExerciseSwaps detects swap vs baseline', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    expect(sessionHasExerciseSwaps(swapped.days[0]!, plan.days[0]!)).toBe(true)
    expect(sessionHasExerciseSwaps(plan.days[0]!, plan.days[0]!)).toBe(false)
  })

  it('buildSessionPlanChanges detects exercise swap from sessionDay', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    const changes = buildSessionPlanChanges(plan, 1, [], swapped.days[0]!)
    expect(changes).toContainEqual({
      kind: 'exercise_swap',
      order: 0,
      fromExerciseId: 'ex1',
      toExerciseId: 'ex2',
    })
  })

  it('buildSessionPlanChanges skips sets/rest changes when exercise was swapped', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    // ex1 had 2 sets, ex2 default has 1 set — but sets change should NOT appear.
    // ex1 rest was 90, ex2 default rest is 60 — but rest change should NOT appear.
    const changes = buildSessionPlanChanges(plan, 1, [], swapped.days[0]!)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.kind).toBe('exercise_swap')
  })

  it('sessionSuggestsPlanUpdate returns true when exercise was swapped', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    expect(sessionSuggestsPlanUpdate(plan, 1, [], swapped.days[0]!)).toBe(true)
  })

  it('applySessionLogsToPlanDay applies exercise swap from sessionDay', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    const map = new Map(exMap)
    map.set('ex2', ex2Def)
    const next = applySessionLogsToPlanDay(plan, 1, [], map, swapped.days[0]!)
    const pe = next.days[0]!.exercises[0]!
    expect(pe.exerciseId).toBe('ex2')
    expect(pe.sets).toEqual([{ durationSec: { kind: 'min', value: 30 } }])
    expect(pe.restBetweenSetsSec).toBe(60)
  })

  it('applySessionLogsToPlanDay applies swap + logged sets as prescriptions', () => {
    const swapped = swapExerciseInSessionDay(plan, 1, 0, 'ex2', ex2Def)!
    const map = new Map(exMap)
    map.set('ex2', ex2Def)
    const logs: ExerciseLog[] = [
      {
        exerciseId: 'ex2',
        order: 0,
        sets: [
          { setNumber: 1, passed: true, actual: { durationSec: 45 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
          { setNumber: 2, passed: true, actual: { durationSec: 40 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
          { setNumber: 3, passed: true, actual: { durationSec: 50 }, prescription: { durationSec: { kind: 'min', value: 30 } } },
        ],
      },
    ]
    const next = applySessionLogsToPlanDay(plan, 1, logs, map, swapped.days[0]!)
    const pe = next.days[0]!.exercises[0]!
    expect(pe.exerciseId).toBe('ex2')
    expect(pe.sets).toHaveLength(3)
    expect(pe.sets[0]).toEqual({ durationSec: { kind: 'fixed', value: 45 } })
    expect(pe.sets[2]).toEqual({ durationSec: { kind: 'fixed', value: 50 } })
  })
})
