import type { Cycle } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'

export type CycleDayStatus = 'completed' | 'current' | 'future'

export function getCycleDayStatus(
  progress: LocalProgramProgress,
  dayNumber: number,
  totalDays: number,
): CycleDayStatus {
  if (progress.status === 'test_pending') {
    return 'completed'
  }
  if (dayNumber < progress.currentDay) return 'completed'
  if (dayNumber === progress.currentDay) return 'current'
  if (dayNumber > totalDays) return 'future'
  return 'future'
}

export function getCompletedDaysInCycle(progress: LocalProgramProgress, cycle: Cycle): number {
  if (progress.status === 'test_pending') {
    return cycle.days.length
  }
  return Math.max(0, progress.currentDay - 1)
}

export function isCycleCompleteForDisplay(progress: LocalProgramProgress): boolean {
  return progress.status === 'test_pending'
}
