import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATALOG, resolveDisplayRarity } from './catalog'
import type { AchievementId, AchievementRarity, LocalAchievementUnlock } from './types'

const STORAGE_KEY = 'achievements_showcase_v1'
export const SHOWCASE_SLOT_COUNT = 4

const RARITY_RANK: Record<AchievementRarity, number> = {
  legendary: 3,
  rare: 2,
  common: 1,
}

type StoredShowcase = {
  /** null = auto-pick; array = user pins (0–3 ids, may include gaps via shorter length) */
  pinnedIds: AchievementId[] | null
}

function readStored(): StoredShowcase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { pinnedIds: null }
    const parsed = JSON.parse(raw) as { pinnedIds?: unknown }
    if (parsed.pinnedIds === null) return { pinnedIds: null }
    if (!Array.isArray(parsed.pinnedIds)) return { pinnedIds: null }
    const ids = parsed.pinnedIds.filter(
      (id): id is AchievementId => typeof id === 'string' && id in ACHIEVEMENT_BY_ID,
    )
    return { pinnedIds: ids.slice(0, SHOWCASE_SLOT_COUNT) }
  } catch {
    return { pinnedIds: null }
  }
}

function writeStored(state: StoredShowcase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getShowcasePinnedIds(): AchievementId[] | null {
  return readStored().pinnedIds
}

/** Persist user picks. Pass `null` to restore auto mode. */
export function setShowcasePinnedIds(ids: AchievementId[] | null): void {
  if (ids === null) {
    writeStored({ pinnedIds: null })
    return
  }
  const unique: AchievementId[] = []
  for (const id of ids) {
    if (!(id in ACHIEVEMENT_BY_ID)) continue
    if (unique.includes(id)) continue
    unique.push(id)
    if (unique.length >= SHOWCASE_SLOT_COUNT) break
  }
  writeStored({ pinnedIds: unique })
}

export function isShowcaseAutoMode(): boolean {
  return getShowcasePinnedIds() === null
}

/** Sort unlocked for auto showcase: rarer first (considering tier rarity), then newest. */
export function rankUnlocksForShowcase(unlocks: LocalAchievementUnlock[]): LocalAchievementUnlock[] {
  return [...unlocks].sort((a, b) => {
    const da = ACHIEVEMENT_BY_ID[a.id]
    const db = ACHIEVEMENT_BY_ID[b.id]
    // Use display rarity (tier-aware) as base rank
    const ra = da ? RARITY_RANK[resolveDisplayRarity(da, null, a.tierLevel)] : 0
    const rb = db ? RARITY_RANK[resolveDisplayRarity(db, null, b.tierLevel)] : 0
    // Tier level boosts ranking within same rarity
    const tierBoostA = (a.tierLevel ?? 0) * 0.5
    const tierBoostB = (b.tierLevel ?? 0) * 0.5
    const scoreA = ra + tierBoostA
    const scoreB = rb + tierBoostB
    if (scoreB !== scoreA) return scoreB - scoreA
    return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
  })
}

/**
 * Resolve up to 3 slot ids for the profile case.
 * Auto: best rarity / newest. Manual: pinned that are still unlocked (order preserved).
 */
export function resolveShowcaseSlots(
  unlocks: LocalAchievementUnlock[],
  pinnedIds: AchievementId[] | null = getShowcasePinnedIds(),
): Array<AchievementId | null> {
  const unlocked = new Set(unlocks.map((u) => u.id))
  const slots: Array<AchievementId | null> = Array.from(
    { length: SHOWCASE_SLOT_COUNT },
    () => null,
  )

  if (pinnedIds === null) {
    const ranked = rankUnlocksForShowcase(unlocks)
      .map((u) => u.id)
      .filter((id) => id in ACHIEVEMENT_BY_ID)
    for (let i = 0; i < SHOWCASE_SLOT_COUNT; i++) {
      slots[i] = ranked[i] ?? null
    }
    return slots
  }

  let i = 0
  for (const id of pinnedIds) {
    if (i >= SHOWCASE_SLOT_COUNT) break
    if (!unlocked.has(id)) continue
    slots[i] = id
    i += 1
  }
  return slots
}

export function showcaseCatalogTotal(): number {
  return ACHIEVEMENT_CATALOG.length
}
