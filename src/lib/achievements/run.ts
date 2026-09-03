import { buildAchievementSnapshot, emptyImpact } from './snapshot'
import { evaluateAchievements } from './evaluate'
import type { AuthorImpactStats, EvaluateResult } from './types'
import { fetchAuthorImpact } from './community-impact'
import { pushAchievementsToCloud } from './sync'
import { getAllUnlocks } from './store'

let evaluating = false

/** Run evaluation after domain events; returns new unlocks for UI queue. */
export async function runAchievementEvaluation(opts?: {
  impact?: AuthorImpactStats
  skipCloud?: boolean
}): Promise<EvaluateResult> {
  if (evaluating) {
    return { newlyUnlocked: [], allUnlocked: await getAllUnlocks(), backfill: false }
  }
  evaluating = true
  try {
    let impact = opts?.impact
    if (!impact) {
      try {
        impact = await fetchAuthorImpact()
      } catch {
        impact = emptyImpact()
      }
    }
    const snap = await buildAchievementSnapshot({ impact })
    const result = await evaluateAchievements(snap)
    if (!opts?.skipCloud && result.newlyUnlocked.length > 0) {
      void pushAchievementsToCloud(result.newlyUnlocked).catch(() => undefined)
    }
    return result
  } finally {
    evaluating = false
  }
}
