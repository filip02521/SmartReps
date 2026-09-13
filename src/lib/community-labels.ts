import { COMMUNITY_TAGS, type CommunityTag } from '@/data/community-tags'
import { pl, type Translation } from '@/i18n/pl'

const TAG_KEYS = {
  home: 'communityTagHome',
  gym: 'communityTagGym',
  bodyweight: 'communityTagBodyweight',
  weights: 'communityTagWeights',
  short_cycle: 'communityTagShortCycle',
  long_cycle: 'communityTagLongCycle',
} as const satisfies Record<CommunityTag, keyof Translation>

// Resolved lazily — `pl` proxies the active dictionary; a materialized map
// would freeze labels in whatever language was active at import time.
export const COMMUNITY_TAG_LABELS: Record<CommunityTag, string> = new Proxy(
  {} as Record<CommunityTag, string>,
  {
    get: (_target, tag: string) => {
      const key = TAG_KEYS[tag as CommunityTag]
      return key ? (pl[key] as string) : undefined
    },
  },
)

export function communityTagLabel(tag: string): string {
  if ((COMMUNITY_TAGS as readonly string[]).includes(tag)) {
    return COMMUNITY_TAG_LABELS[tag as CommunityTag]
  }
  return tag
}

export { COMMUNITY_TAGS }
