import type { AchievementDef, AchievementRarity } from './types'
import { resolveDisplayRarity } from './catalog'

/** Trophy tier — determines shape, fanfare richness, and visual treatment. */
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'diamond'

/**
 * Resolve the tier visual (ring/glow) for an achievement.
 * Mirrors the logic in AchievementTile's tierVisual but is shared.
 *
 * - Tier 1: rarity-based (no override)
 * - Tier 2: silver for common/rare, gold for legendary
 * - Tier 3: gold
 * - Tier 4+: diamond
 *
 * Note: 'bronze' is never returned — tier 1 uses rarity-based visuals.
 * Bronze exists in TrophyTier for future use and for the medal shape.
 */
export function tierVisual(
  rarity: AchievementRarity,
  tierLevel: number | null | undefined,
): 'none' | 'silver' | 'gold' | 'diamond' {
  if (!tierLevel || tierLevel <= 0) return 'none'
  if (tierLevel === 1) return 'none'
  if (tierLevel >= 4) return 'diamond'
  if (tierLevel === 3) return 'gold'
  return rarity === 'legendary' ? 'gold' : 'silver'
}

/**
 * Resolve which trophy shape (if any) to render for an UNLOCKED achievement.
 * Returns null for common/rare/locked — those keep the Lucide icon.
 * Legendary non-tiered → gold cup. Higher tiers → their metallic trophy.
 *
 * Uses resolveDisplayRarity to handle tiered achievements correctly
 * (tier 2 of a legendary achievement resolves to gold, not silver).
 */
export function trophyTierFor(
  def: AchievementDef,
  unlocked: boolean,
  tierLevel: number | null | undefined,
): TrophyTier | null {
  if (!unlocked) return null
  const displayRarity = resolveDisplayRarity(def, null, tierLevel)
  const tv = tierVisual(displayRarity, tierLevel)
  if (tv === 'diamond') return 'diamond'
  if (tv === 'gold') return 'gold'
  if (tv === 'silver') return 'silver'
  // Non-tiered legendary → gold cup trophy
  if (def.rarity === 'legendary') return 'gold'
  return null
}

/**
 * For locked achievements, determine the trophy tier the user is working toward.
 * Used to render a silhouette hint of the upcoming trophy.
 * Only legendary (non-tiered or first-tier legendary) gets a silhouette —
 * common/rare locked achievements keep the Lucide icon.
 */
export function lockedTrophyTierFor(def: AchievementDef): TrophyTier | null {
  if (def.tiers && def.tiers.length > 0) {
    const firstTierRarity = def.tiers[0]?.rarity
    if (firstTierRarity === 'legendary') return 'gold'
    return null
  }
  if (def.rarity === 'legendary') return 'gold'
  return null
}
