import type { AchievementId, AchievementTrack, AchievementRarity } from '@/lib/achievements/types'
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
