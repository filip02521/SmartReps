import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import { trophyTierFor, lockedTrophyTierFor, tierVisual, trophyShapeFor } from '@/lib/achievements/trophy-tier'

describe('trophy-tier — shared logic', () => {
  describe('tierVisual', () => {
    it('returns "none" for tier 0 or 1 (rarity-based, no override)', () => {
      expect(tierVisual('common', 0)).toBe('none')
      expect(tierVisual('rare', 1)).toBe('none')
      expect(tierVisual('legendary', 1)).toBe('none')
    })

    it('returns "silver" for tier 2 common/rare', () => {
      expect(tierVisual('common', 2)).toBe('silver')
      expect(tierVisual('rare', 2)).toBe('silver')
    })

    it('returns "gold" for tier 2 legendary', () => {
      expect(tierVisual('legendary', 2)).toBe('gold')
    })

    it('returns "gold" for tier 3', () => {
      expect(tierVisual('common', 3)).toBe('gold')
      expect(tierVisual('legendary', 3)).toBe('gold')
    })

    it('returns "diamond" for tier 4+', () => {
      expect(tierVisual('common', 4)).toBe('diamond')
      expect(tierVisual('legendary', 5)).toBe('diamond')
    })

    it('never returns "bronze"', () => {
      for (let t = 0; t <= 5; t++) {
        expect(tierVisual('common', t)).not.toBe('bronze')
        expect(tierVisual('rare', t)).not.toBe('bronze')
        expect(tierVisual('legendary', t)).not.toBe('bronze')
      }
    })
  })

  describe('trophyTierFor — unlocked', () => {
    it('returns null for locked achievements', () => {
      const def = ACHIEVEMENT_BY_ID['first_session']!
      expect(trophyTierFor(def, false, null)).toBeNull()
    })

    it('returns null for common non-tiered unlocked', () => {
      const def = ACHIEVEMENT_BY_ID['first_session']!
      expect(trophyTierFor(def, true, null)).toBeNull()
    })

    it('returns null for rare non-tiered unlocked', () => {
      const def = ACHIEVEMENT_BY_ID['streak_4']!
      expect(trophyTierFor(def, true, null)).toBeNull()
    })

    it('returns "gold" for legendary non-tiered unlocked', () => {
      const def = ACHIEVEMENT_BY_ID['streak_26']!
      expect(trophyTierFor(def, true, null)).toBe('gold')
    })

    it('returns null for tier 1 (rarity-based, no trophy)', () => {
      // sessions_100 tier 1 = rare
      const def = ACHIEVEMENT_BY_ID['sessions_100']!
      expect(trophyTierFor(def, true, 1)).toBeNull()
    })

    it('returns "silver" for tier 2 of common/rare achievement', () => {
      // sessions_100 tier 2 = legendary → resolveDisplayRarity returns 'legendary' → gold
      // But tierVisual('legendary', 2) = 'gold', so this is gold not silver
      // Use a non-legendary tier 2 example — check catalog for one
      // habit_builder tier 2 = rare (threshold 5)
      const def = ACHIEVEMENT_BY_ID['habit_builder']!
      expect(trophyTierFor(def, true, 2)).toBe('silver')
    })

    it('returns "gold" for tier 2 of legendary achievement (sessions_100)', () => {
      // sessions_100: base legendary, tier 2 rarity = legendary
      // resolveDisplayRarity(def, null, 2) = 'legendary'
      // tierVisual('legendary', 2) = 'gold'
      const def = ACHIEVEMENT_BY_ID['sessions_100']!
      expect(trophyTierFor(def, true, 2)).toBe('gold')
    })

    it('returns "gold" for tier 3', () => {
      const def = ACHIEVEMENT_BY_ID['sessions_100']!
      expect(trophyTierFor(def, true, 3)).toBe('gold')
    })

    it('returns "diamond" for tier 4+', () => {
      const def = ACHIEVEMENT_BY_ID['sessions_100']!
      expect(trophyTierFor(def, true, 4)).toBe('diamond')
    })

    it('returns "gold" for streak_52 tier 1 (legendary first tier)', () => {
      // streak_52: base legendary, tier 1 rarity = legendary
      // trophyTierFor: tierVisual returns 'none' for tier 1
      // but def.rarity === 'legendary' → gold
      const def = ACHIEVEMENT_BY_ID['streak_52']!
      expect(trophyTierFor(def, true, 1)).toBe('gold')
    })
  })

  describe('lockedTrophyTierFor — locked hints', () => {
    it('returns "gold" for locked legendary non-tiered', () => {
      const def = ACHIEVEMENT_BY_ID['streak_26']!
      expect(lockedTrophyTierFor(def)).toBe('gold')
    })

    it('returns null for locked common non-tiered', () => {
      const def = ACHIEVEMENT_BY_ID['first_session']!
      expect(lockedTrophyTierFor(def)).toBeNull()
    })

    it('returns null for locked rare non-tiered', () => {
      const def = ACHIEVEMENT_BY_ID['streak_4']!
      expect(lockedTrophyTierFor(def)).toBeNull()
    })

    it('returns "gold" for locked tiered with legendary first tier (streak_52)', () => {
      const def = ACHIEVEMENT_BY_ID['streak_52']!
      expect(lockedTrophyTierFor(def)).toBe('gold')
    })

    it('returns null for locked tiered with rare first tier (sessions_100)', () => {
      // sessions_100 tier 1 = rare → no silhouette
      const def = ACHIEVEMENT_BY_ID['sessions_100']!
      expect(lockedTrophyTierFor(def)).toBeNull()
    })
  })

  describe('consistency between trophyTierFor and lockedTrophyTierFor', () => {
    it('locked hint matches what trophy will be when unlocked at tier 1', () => {
      // For all legendary non-tiered: locked hint = gold, unlocked tier 1 = gold
      const defs = Object.values(ACHIEVEMENT_BY_ID).filter(
        (d) => d.rarity === 'legendary' && (!d.tiers || d.tiers.length === 0),
      )
      for (const def of defs) {
        expect(lockedTrophyTierFor(def)).toBe('gold')
        expect(trophyTierFor(def, true, null)).toBe('gold')
      }
    })

    it('locked hint matches what trophy will be for tiered legendary first tier', () => {
      // streak_52: first tier legendary → locked hint = gold, unlocked tier 1 = gold
      const def = ACHIEVEMENT_BY_ID['streak_52']!
      expect(lockedTrophyTierFor(def)).toBe(trophyTierFor(def, true, 1))
    })
  })

  describe('trophyShapeFor — track-based shape', () => {
    it('returns "cup" for training track', () => {
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['first_session']!)).toBe('cup')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['sessions_100']!)).toBe('cup')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['volume_10k']!)).toBe('cup')
    })

    it('returns "shield" for habit track', () => {
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['streak_1']!)).toBe('shield')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['streak_26']!)).toBe('shield')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['habit_builder']!)).toBe('shield')
    })

    it('returns "medal" for catalog track', () => {
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['first_publish']!)).toBe('medal')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['trainer_25']!)).toBe('medal')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['community_pillar']!)).toBe('medal')
    })

    it('returns "crown" for legend track (non-secret)', () => {
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['legend_full_circle']!)).toBe('crown')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['legend_grandmaster']!)).toBe('crown')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['legend_quiet_master']!)).toBe('crown')
    })

    it('returns "diamond" for secret achievements regardless of track', () => {
      // Secret achievements are on legend track but get diamond shape
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['secret_night']!)).toBe('diamond')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['secret_precision']!)).toBe('diamond')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['secret_dawn']!)).toBe('diamond')
      expect(trophyShapeFor(ACHIEVEMENT_BY_ID['secret_marathon']!)).toBe('diamond')
    })

    it('every achievement in catalog resolves to a valid shape', () => {
      for (const def of Object.values(ACHIEVEMENT_BY_ID)) {
        const shape = trophyShapeFor(def)
        expect(['cup', 'shield', 'medal', 'crown', 'diamond']).toContain(shape)
      }
    })
  })
})
