/** Canonical community plan tags — keep in sync with migration 016 CHECK. */
export const COMMUNITY_TAGS = [
  'home',
  'gym',
  'bodyweight',
  'weights',
  'short_cycle',
  'long_cycle',
] as const

export type CommunityTag = (typeof COMMUNITY_TAGS)[number]

export const COMMUNITY_TAG_MAX = 3

export function isCommunityTag(value: string): value is CommunityTag {
  return (COMMUNITY_TAGS as readonly string[]).includes(value)
}

export function normalizeCommunityTags(tags: string[]): CommunityTag[] {
  const out: CommunityTag[] = []
  for (const t of tags) {
    if (isCommunityTag(t) && !out.includes(t)) out.push(t)
    if (out.length >= COMMUNITY_TAG_MAX) break
  }
  return out
}
