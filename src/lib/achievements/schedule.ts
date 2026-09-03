import { runAchievementEvaluation } from './run'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import type { EvaluateResult } from './types'

/** Evaluate + enqueue unlock UI. Prefer await when gallery/state must reflect result. */
export async function runAchievementCheck(): Promise<EvaluateResult | null> {
  try {
    const result = await runAchievementEvaluation()
    if (result.newlyUnlocked.length > 0) {
      useAchievementUiStore.getState().enqueueUnlocks(result.newlyUnlocked, result.backfill)
    }
    return result
  } catch (err) {
    console.warn('[achievements] evaluate failed', err)
    return null
  }
}

/** Fire-and-forget evaluation + UI queue (safe after workouts / community actions). */
export function scheduleAchievementCheck(): void {
  void runAchievementCheck()
}
