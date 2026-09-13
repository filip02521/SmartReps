/**
 * Profile titles — cosmetic names unlocked by specific achievements and
 * selectable on the public profile (Pro perk). A title IS the achievement id:
 * `settings.selectedTitle` stores e.g. 'streak_12', the displayed label comes
 * from `pl.title_<id>` i18n keys.
 *
 * Server-side, `upsert_my_public_profile` validates that the id is in this
 * allowlist AND unlocked in user_achievements — keep the SQL allowlist in
 * migration 088 in sync with TITLE_IDS below.
 */
import { pl } from '@/i18n/pl'
import { ACHIEVEMENT_BY_ID } from './catalog'
import type { AchievementId, AchievementRarity } from './types'

const TITLE_KEYS = {
  // ── Common — early titles so a fresh Pro user has something to pick ──
  first_session: () => pl.title_first_session,
  habit_3_in_14: () => pl.title_habit_3_in_14,
  first_custom_session: () => pl.title_first_custom_session,
  first_squat: () => pl.title_first_squat,
  first_publish: () => pl.title_first_publish,
  first_like: () => pl.title_first_like,
  first_follower: () => pl.title_first_follower,
  social_butterfly: () => pl.title_social_butterfly,
  first_review: () => pl.title_first_review,
  weekend_warrior: () => pl.title_weekend_warrior,
  // ── Rare ──
  streak_4: () => pl.title_streak_4,
  streak_12: () => pl.title_streak_12,
  cycle_closed_strong: () => pl.title_cycle_closed_strong,
  goal_pullups_30: () => pl.title_goal_pullups_30,
  pr_repeat_3: () => pl.title_pr_repeat_3,
  workshop_custom: () => pl.title_workshop_custom,
  plan_with_legs: () => pl.title_plan_with_legs,
  both_programs: () => pl.title_both_programs,
  challenge_first: () => pl.title_challenge_first,
  habit_builder: () => pl.title_habit_builder,
  trainer_25: () => pl.title_trainer_25,
  speed_demon: () => pl.title_speed_demon,
  // ── Legendary ──
  streak_26: () => pl.title_streak_26,
  streak_52: () => pl.title_streak_52,
  sessions_100: () => pl.title_sessions_100,
  goal_pushups_100: () => pl.title_goal_pushups_100,
  goal_pullups_50: () => pl.title_goal_pullups_50,
  goal_squats_300: () => pl.title_goal_squats_300,
  volume_10k: () => pl.title_volume_10k,
  cycles_5: () => pl.title_cycles_5,
  poly_publisher: () => pl.title_poly_publisher,
  challenge_winner: () => pl.title_challenge_winner,
  triple_threat: () => pl.title_triple_threat,
  pr_master: () => pl.title_pr_master,
  cycle_master: () => pl.title_cycle_master,
  followed_by_25: () => pl.title_followed_by_25,
  community_pillar: () => pl.title_community_pillar,
  comeback_stronger: () => pl.title_comeback_stronger,
  legend_full_circle: () => pl.title_legend_full_circle,
  legend_quiet_master: () => pl.title_legend_quiet_master,
  legend_grandmaster: () => pl.title_legend_grandmaster,
  legend_community: () => pl.title_legend_community,
} satisfies Partial<Record<AchievementId, () => string>>

export type TitleId = keyof typeof TITLE_KEYS

/** All title-granting achievement ids — also the SQL allowlist in migration 088. */
export const TITLE_IDS = Object.keys(TITLE_KEYS) as TitleId[]

export function isTitleId(id: string | null | undefined): id is TitleId {
  return typeof id === 'string' && id in TITLE_KEYS
}

/** Localized title label for an achievement id; null when not title-eligible. */
export function getProfileTitle(id: string | null | undefined): string | null {
  if (!isTitleId(id)) return null
  return TITLE_KEYS[id]()
}

/** Rarity of the underlying achievement — drives title styling. */
export function titleRarity(id: string | null | undefined): AchievementRarity | null {
  if (!isTitleId(id)) return null
  return ACHIEVEMENT_BY_ID[id]?.rarity ?? null
}
