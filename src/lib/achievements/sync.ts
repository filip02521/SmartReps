import { supabase } from '@/lib/supabase/client'
import type { LocalAchievementUnlock } from './types'
import { getAllUnlocks, mergeRemoteUnlocks } from './store'

export async function pushAchievementsToCloud(rows: LocalAchievementUnlock[]): Promise<void> {
  if (!supabase || rows.length === 0) return
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const payload = rows.map((r) => ({
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
  // Push any local-only unlocks
  const local = await getAllUnlocks()
  const remoteIds = new Set(data.map((r) => r.achievement_id))
  const missing = local.filter((l) => !remoteIds.has(l.id))
  if (missing.length) await pushAchievementsToCloud(missing)
}
