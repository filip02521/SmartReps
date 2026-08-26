export type SetTarget =
  | { kind: 'fixed'; reps: number }
  | { kind: 'max'; minReps: number }
  | { kind: 'exact'; reps: number }

export type TrainingDay = {
  dayNumber: number
  restBetweenSetsSec: number
  sets: SetTarget[]
  restAfterDay: 1 | 2
}

export type CycleLayout = 'standard_6day' | 'compact_3day' | 'extended_9day'

export type Program = 'pushups' | 'pullups'

export type Cycle = {
  id: string
  program: Program
  name: string
  nameShort: string
  testRange: { min: number; max: number | null }
  level: number
  layout: CycleLayout
  days: TrainingDay[]
  variant?: 'negative' | 'standard'
  description: string
  estimatedWeeks: [number, number]
}
