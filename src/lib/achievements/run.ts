import { buildAchievementSnapshot, emptyImpact } from './snapshot'
import { evaluateAchievements } from './evaluate'
import type { AuthorImpactStats, EvaluateResult } from './types'
import { fetchAuthorImpact } from './community-impact'
import { pushAchievementsToCloud, deleteAchievementsFromCloud } from './sync'

let evaluatingPromise: Promise<EvaluateResult> | null = null

/**
 * Global lock for the achievements subsystem.
 *
 * Both local evaluation (runAchievementEvaluation) and cloud sync
 * (pullAchievementsFromCloud, forceReconcileFromCloud) read and write
 * db.achievementUnlocks. Without mutual exclusion they race: a pull can
 * delete/overwrite a row mid-evaluation, resurrecting a just-deleted unlock
 * or dropping a just-written one.
 *
 * Any code path that mutates achievement state MUST acquire this lock.
 * Callers that don't need the EvaluateResult use withAchievementLock().
 */
let achievementLock: Promise<unknown> | null = null

export function withAchievementLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = achievementLock ?? Promise.resolve()
  const next = prev.then(fn, fn)
  // Keep the chain even if fn rejects so subsequent callers still run.
  achievementLock = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

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
    return await withAchievementLock(async () => {
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
        // Delete revoked rolling-window achievements from cloud
        if (result.revoked.length > 0) {
          void deleteAchievementsFromCloud(result.revoked).catch(() => undefined)
        }
      }
      return result
    })
  } finally {
    evaluatingPromise = null
  }
}
