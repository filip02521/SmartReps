import { db } from '@/lib/db'
import { ACHIEVEMENT_CATALOG } from './catalog'
import type { AchievementId, LocalAchievementUnlock } from './types'

const BACKFILL_KEY = 'achievements_backfill_v1'

/** Set of valid achievement IDs from the catalog — used to validate remote data. */
const VALID_ACHIEVEMENT_IDS = new Set(ACHIEVEMENT_CATALOG.map((d) => d.id))

/** Max tier level per achievement (0 if non-tiered). */
const MAX_TIER_LEVEL = new Map<AchievementId, number>(
  ACHIEVEMENT_CATALOG.map((d) => [d.id, d.tiers?.length ?? 0]),
)

/** Validate and sanitize a remote achievement row. Returns null if invalid. */
function sanitizeRemoteRow(r: {
  achievement_id: string
  unlocked_at: string
  seen_at: string | null
  tier_level?: number | null
}): { id: AchievementId; unlockedAt: string; seenAt: string | null; tierLevel: number | null } | null {
  if (!VALID_ACHIEVEMENT_IDS.has(r.achievement_id as AchievementId)) return null
  const id = r.achievement_id as AchievementId
  // Clamp tier_level to catalog max
  const maxTier = MAX_TIER_LEVEL.get(id) ?? 0
  let tierLevel = r.tier_level ?? null
  if (tierLevel !== null) {
    if (typeof tierLevel !== 'number' || tierLevel < 0) tierLevel = null
    else if (maxTier > 0 && tierLevel > maxTier) tierLevel = maxTier
  }
  // Validate timestamp
  const ts = Date.parse(r.unlocked_at)
  if (isNaN(ts)) return null
  // Reject future dates beyond 1 hour from now (clock skew tolerance)
  if (ts > Date.now() + 3_600_000) return null
  return { id, unlockedAt: r.unlocked_at, seenAt: r.seen_at, tierLevel }
}

function asUnlock(row: {
  id: string
  unlockedAt: string
  seenAt: string | null
  tierLevel?: number | null
}): LocalAchievementUnlock {
  return {
    id: row.id as AchievementId,
    unlockedAt: row.unlockedAt,
    seenAt: row.seenAt,
    tierLevel: row.tierLevel ?? null,
  }
}

export async function getAllUnlocks(): Promise<LocalAchievementUnlock[]> {
  const rows = await db.achievementUnlocks.toArray()
  return rows.map(asUnlock)
}

export async function getUnlock(id: AchievementId): Promise<LocalAchievementUnlock | undefined> {
  const row = await db.achievementUnlocks.get(id)
  return row ? asUnlock(row) : undefined
}

export async function putUnlock(row: LocalAchievementUnlock): Promise<void> {
  await db.achievementUnlocks.put({
    id: row.id,
    unlockedAt: row.unlockedAt,
    seenAt: row.seenAt,
    tierLevel: row.tierLevel ?? null,
  })
}

export async function markUnlockSeen(id: AchievementId, seenAt = new Date().toISOString()): Promise<void> {
  const row = await db.achievementUnlocks.get(id)
  if (!row) return
  if (row.seenAt) return
  const next = { ...row, seenAt }
  await db.achievementUnlocks.put(next)
  void import('./sync')
    .then((m) =>
      m.pushAchievementsToCloud([
        { id: id, unlockedAt: next.unlockedAt, seenAt: next.seenAt, tierLevel: next.tierLevel ?? null },
      ]),
    )
    .catch(() => undefined)
}

export async function markAllUnlocksSeen(ids: AchievementId[], seenAt = new Date().toISOString()): Promise<void> {
  for (const id of ids) {
    await markUnlockSeen(id, seenAt)
  }
}

export async function countUnseenUnlocks(): Promise<number> {
  const all = await getAllUnlocks()
  return all.filter((u) => !u.seenAt).length
}

export async function listUnseenUnlocks(): Promise<LocalAchievementUnlock[]> {
  const all = await getAllUnlocks()
  return all.filter((u) => !u.seenAt)
}

export function hasBackfillFlag(): boolean {
  try {
    return localStorage.getItem(BACKFILL_KEY) === '1'
  } catch {
    return false
  }
}

export function setBackfillFlag(): void {
  try {
    localStorage.setItem(BACKFILL_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Clear the backfill flag — used during account switch / clear local data. */
export function clearBackfillFlag(): void {
  try {
    localStorage.removeItem(BACKFILL_KEY)
  } catch {
    /* ignore */
  }
}

/** Merge remote unlocks (keep earliest unlock, latest seen). Validates against catalog. */
export async function mergeRemoteUnlocks(
  remote: {
    achievement_id: string
    unlocked_at: string
    seen_at: string | null
    tier_level?: number | null
  }[],
): Promise<void> {
  for (const r of remote) {
    const sanitized = sanitizeRemoteRow(r)
    if (!sanitized) continue // reject unknown/invalid achievements
    const { id, unlockedAt, seenAt, tierLevel } = sanitized
    const local = await db.achievementUnlocks.get(id)
    if (!local) {
      await db.achievementUnlocks.put({
        id,
        unlockedAt,
        seenAt,
        tierLevel,
      })
      continue
    }
    const mergedUnlockedAt =
      new Date(unlockedAt).getTime() < new Date(local.unlockedAt).getTime()
        ? unlockedAt
        : local.unlockedAt
    let mergedSeenAt = local.seenAt
    if (seenAt && (!mergedSeenAt || new Date(seenAt).getTime() > new Date(mergedSeenAt).getTime())) {
      mergedSeenAt = seenAt
    }
    // Keep the highest tier level between local and remote (clamped to catalog max)
    const localTier = local.tierLevel ?? 0
    const remoteTier = tierLevel ?? 0
    const mergedTier = Math.max(localTier, remoteTier) || null
    await db.achievementUnlocks.put({ id, unlockedAt: mergedUnlockedAt, seenAt: mergedSeenAt, tierLevel: mergedTier })
  }
}
