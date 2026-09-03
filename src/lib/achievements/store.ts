import { db } from '@/lib/db'
import type { AchievementId, LocalAchievementUnlock } from './types'

const BACKFILL_KEY = 'achievements_backfill_v1'

function asUnlock(row: { id: string; unlockedAt: string; seenAt: string | null }): LocalAchievementUnlock {
  return {
    id: row.id as AchievementId,
    unlockedAt: row.unlockedAt,
    seenAt: row.seenAt,
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
        { id: id, unlockedAt: next.unlockedAt, seenAt: next.seenAt },
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

/** Merge remote unlocks (keep earliest unlock, latest seen). */
export async function mergeRemoteUnlocks(
  remote: { achievement_id: string; unlocked_at: string; seen_at: string | null }[],
): Promise<void> {
  for (const r of remote) {
    const id = r.achievement_id as AchievementId
    const local = await db.achievementUnlocks.get(id)
    if (!local) {
      await db.achievementUnlocks.put({
        id,
        unlockedAt: r.unlocked_at,
        seenAt: r.seen_at,
      })
      continue
    }
    const unlockedAt =
      new Date(r.unlocked_at).getTime() < new Date(local.unlockedAt).getTime()
        ? r.unlocked_at
        : local.unlockedAt
    let seenAt = local.seenAt
    if (r.seen_at && (!seenAt || new Date(r.seen_at).getTime() > new Date(seenAt).getTime())) {
      seenAt = r.seen_at
    }
    await db.achievementUnlocks.put({ id, unlockedAt, seenAt })
  }
}
