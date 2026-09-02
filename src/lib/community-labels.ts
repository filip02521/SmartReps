import { COMMUNITY_TAGS, type CommunityTag } from '@/data/community-tags'
import { pl } from '@/i18n/pl'

const LABELS: Record<CommunityTag, string> = {
  home: pl.communityTagHome,
  gym: pl.communityTagGym,
  bodyweight: pl.communityTagBodyweight,
  weights: pl.communityTagWeights,
  short_cycle: pl.communityTagShortCycle,
  long_cycle: pl.communityTagLongCycle,
}

export function communityTagLabel(tag: string): string {
  if ((COMMUNITY_TAGS as readonly string[]).includes(tag)) {
    return LABELS[tag as CommunityTag]
  }
  return tag
}

export { COMMUNITY_TAGS, LABELS as COMMUNITY_TAG_LABELS }
