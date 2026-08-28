import type { LocalWorkoutSession } from '@/lib/db'

/** Sessions shown in Progress history and CSV export (finished attempts only). */
export function isProgressHistorySession(session: LocalWorkoutSession): boolean {
  return session.status === 'completed'
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
  return (
    records.bestTest !== null ||
    records.bestMaxSet !== null ||
    records.bestSessionTotal !== null ||
    records.highestCycleName !== null
  )
}
