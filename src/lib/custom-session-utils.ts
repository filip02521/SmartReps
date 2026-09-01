import type { LocalWorkoutSession } from '@/lib/db'

/** Custom session detection with legacy fallback (`program: 'custom'` without programKind). */
export function isCustomWorkoutSession(session: LocalWorkoutSession): boolean {
  if (session.programKind === 'custom') return true
  return session.program === 'custom'
}
