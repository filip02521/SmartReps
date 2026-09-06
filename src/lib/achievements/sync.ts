import { supabase } from '@/lib/supabase/client'
import { ACHIEVEMENT_CATALOG } from './catalog'
import type { AchievementId, LocalAchievementUnlock } from './types'
import { getAllUnlocks, mergeRemoteUnlocks } from './store'

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

export async function pullAchievementsFromCloud(): Promise<void> {
  if (!supabase) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at, seen_at, tier_level')
    .eq('user_id', userData.user.id)

  if (error || !data) return
  await mergeRemoteUnlocks(data)
  // Push local-only unlocks that are valid (after merge, re-check)
  const local = await getAllUnlocks()
  const remoteIds = new Set(data.map((r) => r.achievement_id))
  const missing = local.filter((l) => !remoteIds.has(l.id))
  if (missing.length) await pushAchievementsToCloud(missing)
}
