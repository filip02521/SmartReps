import { ACHIEVEMENT_CATALOG, achievementProgress, isAchievementMet } from './catalog'
import type {
  AchievementId,
  AchievementSnapshot,
  AchievementTrack,
  EvaluateResult,
  LocalAchievementUnlock,
} from './types'
import { getAllUnlocks, putUnlock, hasBackfillFlag, setBackfillFlag } from './store'

export async function evaluateAchievements(
  snap: AchievementSnapshot,
  opts?: { forceBackfillCheck?: boolean },
): Promise<EvaluateResult> {
  const existing = await getAllUnlocks()
  const byId = new Map(existing.map((u) => [u.id, u]))
  const newlyUnlocked: LocalAchievementUnlock[] = []
  const firstRun = opts?.forceBackfillCheck || !hasBackfillFlag()

  for (const def of ACHIEVEMENT_CATALOG) {
    if (!isAchievementMet(def.id, snap)) continue
    if (byId.has(def.id)) continue

    const hint = snap.unlockAtHints[def.id]
    const unlockedAt = hint ?? snap.now.toISOString()
    const row: LocalAchievementUnlock = {
      id: def.id,
      unlockedAt,
      // Backfill: mark seen so we only show one summary sheet, not N unlock sheets
      seenAt: firstRun ? unlockedAt : null,
    }
    await putUnlock(row)
    byId.set(def.id, row)
    newlyUnlocked.push(row)
  }

  if (firstRun) {
    setBackfillFlag()
  }

  return {
    newlyUnlocked,
    allUnlocked: [...byId.values()],
    backfill: firstRun && newlyUnlocked.length > 0,
  }
}

export function pickInProgress(
  snap: AchievementSnapshot,
  unlockedIds: Set<AchievementId>,
  limit = 2,
  opts?: { track?: AchievementTrack },
): { id: AchievementId; current: number; target: number }[] {
  const out: { id: AchievementId; current: number; target: number }[] = []
  for (const def of ACHIEVEMENT_CATALOG) {
    if (opts?.track && def.track !== opts.track) continue
    if (unlockedIds.has(def.id)) continue
    if (def.isSecret) continue
    if (isAchievementMet(def.id, snap)) continue
    const p = achievementProgress(def.id, snap)
    if (!p || p.current <= 0) continue
    out.push({ id: def.id, ...p })
    if (out.length >= limit) break
  }
  return out
}
