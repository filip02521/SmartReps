import {
  ACHIEVEMENT_CATALOG,
  achievementProgress,
  isAchievementMet,
  resolveTier,
} from './catalog'
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

    const resolved = resolveTier(def, snap)
    const newTierLevel = resolved?.level ?? 0
    const existingRow = byId.get(def.id)

    if (existingRow) {
      // Already unlocked — check for tier upgrade
      const oldTierLevel = existingRow.tierLevel ?? 0
      if (def.tiers && def.tiers.length > 0 && newTierLevel > oldTierLevel) {
        // Tier upgrade: keep original unlockedAt, update tier level, mark unseen
        const upgraded: LocalAchievementUnlock = {
          id: def.id,
          unlockedAt: existingRow.unlockedAt,
          // Mark unseen so the unlock sheet shows again for the tier upgrade
          seenAt: null,
          tierLevel: newTierLevel,
        }
        await putUnlock(upgraded)
        byId.set(def.id, upgraded)
        newlyUnlocked.push(upgraded)
      }
      continue
    }

    // New unlock
    const hint = snap.unlockAtHints[def.id]
    const unlockedAt = hint ?? snap.now.toISOString()
    const row: LocalAchievementUnlock = {
      id: def.id,
      unlockedAt,
      // Backfill: mark seen so we only show one summary sheet, not N unlock sheets
      seenAt: firstRun ? unlockedAt : null,
      tierLevel: def.tiers && def.tiers.length > 0 ? newTierLevel : null,
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
    if (def.isSecret) continue
    // For tiered achievements, include even if first tier is met (progress to next tier)
    if (def.tiers && def.tiers.length > 0) {
      const resolved = resolveTier(def, snap)
      if (resolved && resolved.level >= resolved.maxLevel) continue // all tiers done
      const p = achievementProgress(def.id, snap)
      if (!p || p.current <= 0) continue
      out.push({ id: def.id, ...p })
      if (out.length >= limit) break
      continue
    }
    if (unlockedIds.has(def.id)) continue
    if (isAchievementMet(def.id, snap)) continue
    const p = achievementProgress(def.id, snap)
    if (!p || p.current <= 0) continue
    out.push({ id: def.id, ...p })
    if (out.length >= limit) break
  }
  return out
}
