import { buildAchievementSnapshot, emptyImpact } from './snapshot'
import { evaluateAchievements } from './evaluate'
import type { AuthorImpactStats, EvaluateResult } from './types'
import { fetchAuthorImpact } from './community-impact'
import { pushAchievementsToCloud } from './sync'

let evaluatingPromise: Promise<EvaluateResult> | null = null

/** Run evaluation after domain events; returns new unlocks for UI queue.
 *  Concurrent calls share the same in-flight evaluation so unlocks are never lost. */
export function runAchievementEvaluation(opts?: {
  impact?: AuthorImpactStats
  skipCloud?: boolean
}): Promise<EvaluateResult> {
  if (evaluatingPromise) return evaluatingPromise
  evaluatingPromise = doEvaluate(opts)
  return evaluatingPromise
}

async function doEvaluate(opts?: {
  impact?: AuthorImpactStats
  skipCloud?: boolean
}): Promise<EvaluateResult> {
  try {
    let impact = opts?.impact
    if (!impact) {
      try {
        impact = await fetchAuthorImpact()
      } catch {
        impact = emptyImpact()
      }
    }
    // Force: evaluation must always read fresh data — a workout just completed,
    // a session was deleted, or data was imported. Stale cache would miss unlocks.
    const snap = await buildAchievementSnapshot({ impact, force: true })
    const result = await evaluateAchievements(snap)
    if (!opts?.skipCloud) {
      const toPush = [...result.newlyUnlocked, ...result.tierChanged]
      if (toPush.length > 0) {
        void pushAchievementsToCloud(toPush).catch(() => undefined)
      }
    }
    return result
  } finally {
    evaluatingPromise = null
  }
}
