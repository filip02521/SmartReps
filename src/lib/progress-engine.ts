import type { SetTarget } from '@/data/plans/types'

export function validateSet(target: SetTarget, actual: number): boolean {
  switch (target.kind) {
    case 'fixed':
      return actual >= target.reps
    case 'max':
      return actual >= target.minReps
    case 'exact':
      return actual >= target.reps
  }
}

export function getTargetReps(target: SetTarget): number {
  switch (target.kind) {
    case 'fixed':
    case 'exact':
      return target.reps
    case 'max':
      return target.minReps
  }
}

export function formatSetTarget(target: SetTarget): string {
  switch (target.kind) {
    case 'fixed':
      return String(target.reps)
    case 'max':
      return `MAX · min ${target.minReps}`
    case 'exact':
      return `Równo ${target.reps}`
  }
}

export function getSetLabel(target: SetTarget, program: 'pushups' | 'pullups'): string {
  const unit = program === 'pushups' ? 'pompek' : 'podciągnięć'
  switch (target.kind) {
    case 'fixed':
      return `Zrób ${target.reps} ${unit}`
    case 'max':
      return `MAX — minimum ${target.minReps}`
    case 'exact':
      return `Wykonaj ${target.reps} opuszczeń`
  }
}

export type ProgramStatus =
  | 'active'
  | 'rest'
  | 'test_pending'
  | 'cycle_failed'
  | 'paused'

export type SetResultDraft = {
  setNumber: number
  target: SetTarget
  actual: number
  passed: boolean
}

export function allSetsPassed(results: SetResultDraft[]): boolean {
  return results.length > 0 && results.every((r) => r.passed)
}

export function getNextWorkoutDate(lastWorkout: Date, restDays: number): Date {
  const d = new Date(lastWorkout)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + restDays + 1)
  return d
}

export function isWorkoutAvailable(nextWorkoutAfter: Date | null): boolean {
  if (!nextWorkoutAfter) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(nextWorkoutAfter)
  next.setHours(0, 0, 0, 0)
  return today >= next
}

export function daysUntilWorkout(nextWorkoutAfter: Date | null): number {
  if (!nextWorkoutAfter) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(nextWorkoutAfter)
  next.setHours(0, 0, 0, 0)
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export function advanceAfterDayPassed(
  currentDay: number,
  totalDays: number,
): { nextDay: number; cycleComplete: boolean } {
  if (currentDay >= totalDays) {
    return { nextDay: 1, cycleComplete: true }
  }
  return { nextDay: currentDay + 1, cycleComplete: false }
}

export function getCelebrationBadge(
  program: 'pushups' | 'pullups',
  reps: number,
): string | null {
  if (program === 'pushups' && reps >= 100) return 'Cel 100 pompek osiągnięty!'
  if (program === 'pullups') {
    if (reps >= 50) return 'Cel ambicji osiągnięty!'
    if (reps >= 30) return 'Cel główny osiągnięty!'
  }
  return null
}

export function getTestBlockDays(): number {
  return 2
}
