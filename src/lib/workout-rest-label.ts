import type { SetTarget } from '@/data/plans/types'
import { getTargetReps } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'

/** Label under rest timer — currentSetIndex already points at the next set after completeSet(). */
export function getRestNextSetLabel(
  currentSetIndex: number,
  sets: SetTarget[],
  unit: string,
  isResting: boolean,
): string {
  if (!isResting) return ''
  const next = sets[currentSetIndex]
  if (!next) return ''
  return pl.nextSet(currentSetIndex + 1, getTargetReps(next), unit)
}
