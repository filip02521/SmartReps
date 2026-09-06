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
  const tierChanged: LocalAchievementUnlock[] = []
  const firstRun = opts?.forceBackfillCheck || !hasBackfillFlag()

  for (const def of ACHIEVEMENT_CATALOG) {
    const met = isAchievementMet(def.id, snap)
    const resolved = resolveTier(def, snap)
    const newTierLevel = resolved?.level ?? 0
    const existingRow = byId.get(def.id)
    const isTiered = Boolean(def.tiers && def.tiers.length > 0)

    if (existingRow) {
      const oldTierLevel = existingRow.tierLevel ?? 0

      if (isTiered) {
        // Tiered achievements: tier reflects current stats — upgrade OR downgrade
        if (newTierLevel > oldTierLevel) {
          // Upgrade: keep original unlockedAt, update tier, mark unseen for celebration
          const upgraded: LocalAchievementUnlock = {
            id: def.id,
            unlockedAt: existingRow.unlockedAt,
            seenAt: null,
            tierLevel: newTierLevel,
          }
          await putUnlock(upgraded)
          byId.set(def.id, upgraded)
          newlyUnlocked.push(upgraded)
        } else if (newTierLevel < oldTierLevel && newTierLevel > 0) {
          // Downgrade: keep unlockedAt, update tier, keep seenAt (no celebration for downgrade)
          const downgraded: LocalAchievementUnlock = {
            id: def.id,
            unlockedAt: existingRow.unlockedAt,
            seenAt: existingRow.seenAt,
            tierLevel: newTierLevel,
          }
          await putUnlock(downgraded)
          byId.set(def.id, downgraded)
          tierChanged.push(downgraded)
        }
        // If newTierLevel === 0 (first tier no longer met), keep the row at tier 1 minimum
        // — revoking entirely would be confusing and the achievement was genuinely earned.
        else if (newTierLevel === 0 && oldTierLevel > 1) {
          const floor: LocalAchievementUnlock = {
            id: def.id,
            unlockedAt: existingRow.unlockedAt,
            seenAt: existingRow.seenAt,
            tierLevel: 1,
          }
          await putUnlock(floor)
          byId.set(def.id, floor)
          tierChanged.push(floor)
        }
      }
      // Non-tiered achievements: once earned, always earned (historical)
      continue
    }

    // No existing row — only create if met
    if (!met) continue

    // New unlock
    const hint = snap.unlockAtHints[def.id]
    const unlockedAt = hint ?? snap.now.toISOString()
    const row: LocalAchievementUnlock = {
      id: def.id,
      unlockedAt,
      // Backfill: mark seen so we only show one summary sheet, not N unlock sheets.
      // On firstRun (fresh install, after clear-local-data, or after account switch),
      // all retroactively-earned achievements are treated as backfill — the user
      // didn't just now earn them, their historical data simply triggered them.
      // A genuinely fresh unlock (firstRun already set) always shows the sheet.
      seenAt: firstRun ? unlockedAt : null,
      tierLevel: isTiered ? newTierLevel : null,
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
    // Backfill summary is shown when firstRun unlocked retroactive achievements.
    // The UI store shows a single "You earned N achievements" summary instead of
    // N individual celebration sheets.
    backfill: firstRun && newlyUnlocked.length > 0,
    tierChanged,
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
