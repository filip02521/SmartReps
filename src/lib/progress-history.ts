import type { LocalWorkoutSession } from '@/lib/db'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'

/** Sessions shown in Progress history and CSV export (finished attempts only). */
export function isProgressHistorySession(session: LocalWorkoutSession): boolean {
  return session.status === 'completed'
}

export function isCustomProgressHistorySession(session: LocalWorkoutSession): boolean {
  return isCustomWorkoutSession(session) && isProgressHistorySession(session)
}

export function sessionTotalReps(session: LocalWorkoutSession): number {
  if (session.totalReps != null) return session.totalReps
  return session.setResults.reduce((sum, r) => sum + r.actual, 0)
}

export type ProgramRecords = {
  bestTest: number | null
  bestMaxSet: number | null
  bestSessionTotal: number | null
  highestCycleName: string | null
}

export function hasAnyProgramRecords(records: ProgramRecords): boolean {
  // bestTest lives in the overview MetricStrip — do not count it as Rekordy content.
  return (
    records.bestMaxSet !== null ||
    records.bestSessionTotal !== null ||
    records.highestCycleName !== null
  )
}
