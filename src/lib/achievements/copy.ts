import type { AchievementId, AchievementTrack, AchievementRarity } from '@/lib/achievements/types'
import type { TrophyTier, TrophyShapeKind } from '@/lib/achievements/trophy-tier'
import { pl } from '@/i18n/pl'

type PlKey = keyof typeof pl

export function achievementTitle(id: AchievementId): string {
  const key = `achievement_${id}_title` as PlKey
  const v = pl[key]
  return typeof v === 'string' ? v : id
}

export function achievementDesc(id: AchievementId): string {
  const key = `achievement_${id}_desc` as PlKey
  const v = pl[key]
  return typeof v === 'string' ? v : ''
}

export function achievementTrackLabel(track: AchievementTrack): string {
  switch (track) {
    case 'training':
      return pl.achievementsTrackTraining
    case 'habit':
      return pl.achievementsTrackHabit
    case 'catalog':
      return pl.achievementsTrackCatalog
    case 'legend':
      return pl.achievementsTrackLegend
  }
}

export function achievementRarityLabel(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'common':
      return pl.achievementsRarityCommon
    case 'rare':
      return pl.achievementsRarityRare
    case 'legendary':
      return pl.achievementsRarityLegendary
  }
}

/** Label for the trophy's metallic material (bronze/silver/gold/diamond) — feminine singular. */
export function trophyMaterialLabel(tier: TrophyTier): string {
  switch (tier) {
    case 'bronze':
      return pl.achievementsTrophyBronze
    case 'silver':
      return pl.achievementsTrophySilver
    case 'gold':
      return pl.achievementsTrophyGold
    case 'diamond':
      return pl.achievementsTrophyDiamond
  }
}

/** Plural material label — for summary counts ("2 złote"). */
export function trophyMaterialLabelPlural(tier: TrophyTier): string {
  switch (tier) {
    case 'bronze':
      return pl.achievementsTrophyBronzePl
    case 'silver':
      return pl.achievementsTrophySilverPl
    case 'gold':
      return pl.achievementsTrophyGoldPl
    case 'diamond':
      return pl.achievementsTrophyDiamondPl
  }
}

/** Shape grammatical gender — determines adjective agreement in Polish. */
const SHAPE_GENDER: Record<TrophyShapeKind, 'm' | 'f'> = {
  cup: 'm', // puchar
  shield: 'f', // tarcza
  medal: 'm', // medal
  crown: 'f', // korona
  diamond: 'm', // klejnot
}

/** Material adjective agreeing with shape gender. */
function trophyMaterialAdjective(tier: TrophyTier, gender: 'm' | 'f'): string {
  if (gender === 'm') {
    switch (tier) {
      case 'bronze':
        return pl.achievementsTrophyBronzeM
      case 'silver':
        return pl.achievementsTrophySilverM
      case 'gold':
        return pl.achievementsTrophyGoldM
      case 'diamond':
        return pl.achievementsTrophyDiamondM
    }
  }
  return trophyMaterialLabel(tier)
}

/** Label for the trophy's shape (cup/shield/medal/crown/diamond). */
export function trophyShapeLabel(shape: TrophyShapeKind): string {
  switch (shape) {
    case 'cup':
      return pl.achievementsTrophyShapeCup
    case 'shield':
      return pl.achievementsTrophyShapeShield
    case 'medal':
      return pl.achievementsTrophyShapeMedal
    case 'crown':
      return pl.achievementsTrophyShapeCrown
    case 'diamond':
      return pl.achievementsTrophyShapeDiamond
  }
}

/** Combined label — material adjective + shape noun, e.g. "Złoty puchar" / "Złota tarcza". */
export function trophyFullLabel(tier: TrophyTier, shape: TrophyShapeKind): string {
  const gender = SHAPE_GENDER[shape]
  const adjective = trophyMaterialAdjective(tier, gender)
  const shapeLabel = trophyShapeLabel(shape)
  return pl.achievementsTrophyFullLabel(adjective, shapeLabel)
}
