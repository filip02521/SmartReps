import type { SetTarget } from '@/data/plans/types'
import { getTargetReps } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'

/** Label under rest timer — currentSetIndex already points at the next set after completeSet(). */
export function getRestNextSetLabel(
  currentSetIndex: number,
  sets: SetTarget[],
  unit: string,
  isResting: boolean,
  previousActual?: number,
): string {
  if (!isResting) return ''
  const next = sets[currentSetIndex]
  if (!next) return ''
  const targetReps = getTargetReps(next)
  if (previousActual !== undefined && previousActual > 0) {
    return pl.nextSetWithPrevious(currentSetIndex + 1, targetReps, unit, previousActual)
  }
  return pl.nextSet(currentSetIndex + 1, targetReps, unit)
}
