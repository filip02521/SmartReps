import { supabase } from '@/lib/supabase/client'
import { ACHIEVEMENT_CATALOG, isAchievementMet } from './catalog'
import type { AchievementId, LocalAchievementUnlock } from './types'
import { getAllUnlocks, mergeRemoteUnlocks, setSuppressedAchievements, clearSuppressedAchievements, getSuppressedAchievements } from './store'
import { buildAchievementSnapshot } from './snapshot'
import { withAchievementLock } from './run'
import { db } from '@/lib/db'

/** Set of valid achievement IDs — used to validate before pushing to cloud. */
const VALID_IDS = new Set(ACHIEVEMENT_CATALOG.map((d) => d.id))

/** Max tier per achievement — used to clamp before pushing. */
const MAX_TIER = new Map<AchievementId, number>(
  ACHIEVEMENT_CATALOG.map((d) => [d.id, d.tiers?.length ?? 0]),
)

/** Filter and clamp rows before pushing to cloud — rejects unknown IDs and invalid tiers. */
function validateForPush(rows: LocalAchievementUnlock[]): LocalAchievementUnlock[] {
  return rows
    .filter((r) => VALID_IDS.has(r.id))
    .map((r) => {
      const max = MAX_TIER.get(r.id) ?? 0
      let tierLevel: number | null = r.tierLevel ?? null
      if (tierLevel !== null && max > 0 && tierLevel > max) tierLevel = max
      if (tierLevel !== null && tierLevel < 0) tierLevel = null
      return { ...r, tierLevel }
    })
}

export async function pushAchievementsToCloud(rows: LocalAchievementUnlock[]): Promise<void> {
  if (!supabase) return
  const valid = validateForPush(rows)
  if (valid.length === 0) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const payload = valid.map((r) => ({
    user_id: userData.user!.id,
    achievement_id: r.id,
    unlocked_at: r.unlockedAt,
    seen_at: r.seenAt,
    tier_level: r.tierLevel ?? null,
  }))

  const { error } = await supabase.from('user_achievements').upsert(payload, {
    onConflict: 'user_id,achievement_id',
  })
  if (error) console.warn('[achievements] push failed', error.message)
}

/** Delete revoked achievements from cloud — used for rolling-window achievements
 *  whose criteria are no longer met. Prevents resurrection from other devices. */
export async function deleteAchievementsFromCloud(ids: AchievementId[]): Promise<void> {
  if (!supabase) return
  if (ids.length === 0) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const { error } = await supabase
    .from('user_achievements')
    .delete()
    .eq('user_id', userData.user!.id)
    .in('achievement_id', ids)
  if (error) console.warn('[achievements] delete failed', error.message)
}

export async function pullAchievementsFromCloud(): Promise<void> {
  if (!supabase) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, seen_at, tier_level')
    .eq('user_id', userData.user.id)

  if (error || !data) return

  // Cloud is source of truth — delete local achievements NOT in remote
  // (after merge) that are not currently met by snapshot.
  // This is the only way to remove erroneously-unlocked achievements.
  await withAchievementLock(async () => {
    await mergeRemoteUnlocks(data)

    const local = await getAllUnlocks()
    const remoteIds = new Set(data.map((r) => r.achievement_id))
    const missing = local.filter((l) => !remoteIds.has(l.id))

    const toDelete: AchievementId[] = []
    if (missing.length) {
      const snap = await buildAchievementSnapshot({ force: true }).catch(() => null)
      for (const unlock of missing) {
        // Delete if not in remote AND not currently met by snapshot
        if (snap && !isAchievementMet(unlock.id, snap)) {
          toDelete.push(unlock.id)
        }
      }
      if (toDelete.length) {
        await db.achievementUnlocks.bulkDelete(toDelete)
        // Add to suppressed list so evaluateAchievements won't re-create them
        const existing = getSuppressedAchievements()
        const merged = new Set([...existing, ...toDelete])
        setSuppressedAchievements([...merged])
      }
    }

    // Push remaining local-only unlocks (legitimate offline unlocks) to cloud
    const deletedSet = new Set(toDelete)
    const remaining = missing.filter((l) => !deletedSet.has(l.id))
    if (remaining.length) await pushAchievementsToCloud(remaining)
  })
}

/**
 * Force-reconcile: cloud is absolute source of truth.
 * Delete ALL local achievements not present in remote, regardless of snapshot.
 * Suppressed IDs are recorded so evaluateAchievements won't re-create them.
 * Use after clearAllLocalData + cloud pull to ensure local matches cloud exactly.
 */
export async function forceReconcileFromCloud(): Promise<void> {
  if (!supabase) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, seen_at, tier_level')
    .eq('user_id', userData.user.id)

  if (error || !data) return

  await withAchievementLock(async () => {
    // Record which local achievements are being removed (not in remote)
    // so evaluateAchievements won't re-create them
    const local = await getAllUnlocks()
    const remoteIds = new Set(data.map((r) => r.achievement_id))
    const removed = local.filter((l) => !remoteIds.has(l.id)).map((l) => l.id)
    if (removed.length > 0) {
      setSuppressedAchievements(removed)
    } else {
      clearSuppressedAchievements()
    }

    // Replace local entirely with remote
    await db.achievementUnlocks.clear()
    await mergeRemoteUnlocks(data)
  })
}
