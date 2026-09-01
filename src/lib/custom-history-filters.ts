import type { LocalWorkoutSession } from '@/lib/db'
import { isCustomProgressHistorySession } from '@/lib/progress-history'

export type CustomHistoryFilters = {
  planId: string | 'all'
  result: 'all' | 'passed' | 'failed'
  dayNumber?: number | 'all'
}

export function filterCustomHistorySessions(
  sessions: LocalWorkoutSession[],
  filters: CustomHistoryFilters,
): LocalWorkoutSession[] {
  return sessions.filter((s) => {
    if (!isCustomProgressHistorySession(s)) return false
    if (filters.planId !== 'all' && s.customPlanId !== filters.planId) return false
    if (filters.dayNumber != null && filters.dayNumber !== 'all' && s.dayNumber !== filters.dayNumber) {
      return false
    }
    if (filters.result === 'passed' && s.passed !== true) return false
    if (filters.result === 'failed' && s.passed === true) return false
    return true
  })
}
