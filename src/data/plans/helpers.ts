import type { SetTarget, TrainingDay } from './types'

export function fixed(...reps: number[]): SetTarget[] {
  return reps.map((r) => ({ kind: 'fixed' as const, reps: r }))
}

export function maxSet(minReps: number): SetTarget {
  return { kind: 'max', minReps }
}

export function exactSet(reps: number): SetTarget {
  return { kind: 'exact', reps }
}

export function setsWithMax(reps: number[], minReps: number): SetTarget[] {
  return [...fixed(...reps), maxSet(minReps)]
}

export function setsWithExact(reps: number[], exactReps: number): SetTarget[] {
  return [...fixed(...reps), exactSet(exactReps)]
}

type DaySpec = {
  restBetweenSetsSec: number
  reps: number[]
  restAfterDay: 1 | 2
  lastSet: { kind: 'max'; minReps: number } | { kind: 'exact'; reps: number }
}

export function buildDay(dayNumber: number, spec: DaySpec): TrainingDay {
  const sets =
    spec.lastSet.kind === 'max'
      ? setsWithMax(spec.reps, spec.lastSet.minReps)
      : setsWithExact(spec.reps, spec.lastSet.reps)

  return {
    dayNumber,
    restBetweenSetsSec: spec.restBetweenSetsSec,
    sets,
    restAfterDay: spec.restAfterDay,
  }
}

const STANDARD_6_REST_AFTER = [1, 1, 2, 1, 1, 2] as const
const EXTENDED_9_REST_AFTER = [1, 1, 2, 1, 1, 2, 1, 1, 2] as const

type MaxDay = { reps: number[]; maxMin: number }

export function standard6DayPushup(
  days: Array<{ rest: 60 | 90 | 120; reps: number[]; maxMin: number }>,
): TrainingDay[] {
  return days.map((d, i) =>
    buildDay(i + 1, {
      restBetweenSetsSec: d.rest,
      reps: d.reps,
      restAfterDay: STANDARD_6_REST_AFTER[i],
      lastSet: { kind: 'max', minReps: d.maxMin },
    }),
  )
}

export function compact3DayPushup(
  day1: MaxDay,
  day2: MaxDay,
  day3: MaxDay,
  options?: { day3RestSec?: 35 | 45 },
): TrainingDay[] {
  const day3Rest = options?.day3RestSec ?? 45
  return [
    buildDay(1, {
      restBetweenSetsSec: 60,
      reps: day1.reps,
      restAfterDay: 1,
      lastSet: { kind: 'max', minReps: day1.maxMin },
    }),
    buildDay(2, {
      restBetweenSetsSec: 45,
      reps: day2.reps,
      restAfterDay: 1,
      lastSet: { kind: 'max', minReps: day2.maxMin },
    }),
    buildDay(3, {
      restBetweenSetsSec: day3Rest,
      reps: day3.reps,
      restAfterDay: 2,
      lastSet: { kind: 'max', minReps: day3.maxMin },
    }),
  ]
}

export function standard6DayPullup(days: MaxDay[]): TrainingDay[] {
  return days.map((d, i) =>
    buildDay(i + 1, {
      restBetweenSetsSec: 120,
      reps: d.reps,
      restAfterDay: STANDARD_6_REST_AFTER[i],
      lastSet: { kind: 'max', minReps: d.maxMin },
    }),
  )
}

export function extended9DayPullup(days: MaxDay[]): TrainingDay[] {
  return days.map((d, i) =>
    buildDay(i + 1, {
      restBetweenSetsSec: 120,
      reps: d.reps,
      restAfterDay: EXTENDED_9_REST_AFTER[i],
      lastSet: { kind: 'max', minReps: d.maxMin },
    }),
  )
}

type ExactDay = { reps: number[]; exact: number }

export function standard6DayPullupExact(days: ExactDay[]): TrainingDay[] {
  return days.map((d, i) =>
    buildDay(i + 1, {
      restBetweenSetsSec: 120,
      reps: d.reps,
      restAfterDay: STANDARD_6_REST_AFTER[i],
      lastSet: { kind: 'exact', reps: d.exact },
    }),
  )
}
