import type { AchievementDef, AchievementId, AchievementSnapshot, AchievementProgress } from './types'

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  { id: 'first_session', track: 'training', rarity: 'common', glyph: 'dumbbell' },
  { id: 'habit_3_in_14', track: 'training', rarity: 'common', glyph: 'target' },
  { id: 'first_custom_session', track: 'training', rarity: 'common', glyph: 'list' },
  { id: 'cycle_closed_strong', track: 'training', rarity: 'rare', glyph: 'flag' },
  { id: 'goal_pullups_30', track: 'training', rarity: 'rare', glyph: 'pull' },
  { id: 'workshop_custom', track: 'training', rarity: 'rare', glyph: 'wrench' },
  { id: 'pr_repeat_3', track: 'training', rarity: 'rare', glyph: 'trending' },
  { id: 'goal_pushups_100', track: 'training', rarity: 'legendary', glyph: 'hundred' },
  { id: 'goal_pullups_50', track: 'training', rarity: 'legendary', glyph: 'pull50' },
  { id: 'sessions_100', track: 'training', rarity: 'legendary', glyph: 'layers' },

  { id: 'streak_1', track: 'habit', rarity: 'common', glyph: 'calendar' },
  { id: 'streak_4', track: 'habit', rarity: 'rare', glyph: 'calendar' },
  { id: 'streak_12', track: 'habit', rarity: 'rare', glyph: 'flame' },
  { id: 'streak_52', track: 'habit', rarity: 'legendary', glyph: 'crown' },
  { id: 'comeback_stronger', track: 'habit', rarity: 'legendary', glyph: 'refresh' },

  { id: 'first_publish', track: 'catalog', rarity: 'common', glyph: 'upload' },
  { id: 'first_like', track: 'catalog', rarity: 'common', glyph: 'heart' },
  { id: 'first_import', track: 'catalog', rarity: 'rare', glyph: 'download' },
  { id: 'first_trained', track: 'catalog', rarity: 'rare', glyph: 'users' },
  { id: 'plan_with_legs', track: 'catalog', rarity: 'rare', glyph: 'footprints' },
  { id: 'trainer_25', track: 'catalog', rarity: 'legendary', glyph: 'users' },
  { id: 'poly_publisher', track: 'catalog', rarity: 'legendary', glyph: 'library' },

  { id: 'legend_full_circle', track: 'legend', rarity: 'legendary', glyph: 'logo' },
  { id: 'legend_quiet_master', track: 'legend', rarity: 'legendary', glyph: 'shield' },
  { id: 'secret_night', track: 'legend', rarity: 'legendary', isSecret: true, glyph: 'moon' },
  { id: 'secret_precision', track: 'legend', rarity: 'legendary', isSecret: true, glyph: 'crosshair' },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENT_CATALOG.map((a) => [a.id, a]),
) as Record<AchievementId, AchievementDef>

export function isAchievementMet(id: AchievementId, snap: AchievementSnapshot): boolean {
  switch (id) {
    case 'first_session':
      return snap.completedCount >= 1
    case 'habit_3_in_14':
      return snap.completedInLast14d >= 3
    case 'first_custom_session':
      return snap.customCompletedCount >= 1
    case 'cycle_closed_strong':
      return snap.hasCycleClosedStrong
    case 'goal_pushups_100':
      return snap.maxPushups >= 100
    case 'goal_pullups_50':
      return snap.maxPullups >= 50
    case 'goal_pullups_30':
      return snap.maxPullups >= 30
    case 'workshop_custom':
      return snap.workshopCustom
    case 'pr_repeat_3':
      return snap.prRepeatMax >= 3
    case 'sessions_100':
      return snap.completedCount >= 100
    case 'streak_1':
      return snap.streakWeeks >= 1
    case 'streak_4':
      return snap.bestStreakWeeks >= 4
    case 'streak_12':
      return snap.bestStreakWeeks >= 12
    case 'streak_52':
      return snap.bestStreakWeeks >= 52
    case 'comeback_stronger':
      return snap.comebackStronger
    case 'first_publish':
      return snap.impact.publishedCount >= 1
    case 'first_like':
      return snap.impact.likeTotal >= 1
    case 'first_import':
      return snap.impact.importTotal >= 1
    case 'first_trained':
      return snap.impact.trainedTotal >= 1
    case 'plan_with_legs':
      return snap.impact.bestPlanImports >= 5 && snap.impact.bestPlanTrained >= 1
    case 'trainer_25':
      return snap.impact.trainedTotal >= 25
    case 'poly_publisher':
      return snap.impact.publishedCount >= 3 && snap.impact.importTotal >= 10
    case 'legend_full_circle':
      return (
        (snap.maxPushups >= 100 || snap.maxPullups >= 50) &&
        snap.bestStreakWeeks >= 12 &&
        snap.impact.trainedTotal >= 1
      )
    case 'legend_quiet_master':
      return snap.completedCount >= 200 && snap.bestStreakWeeks >= 26
    case 'secret_night':
      return snap.nightSessionCount >= 10
    case 'secret_precision':
      return snap.customHitTargetCount >= 20
    default:
      return false
  }
}

export function achievementProgress(
  id: AchievementId,
  snap: AchievementSnapshot,
): AchievementProgress {
  switch (id) {
    case 'habit_3_in_14':
      return { current: Math.min(snap.completedInLast14d, 3), target: 3 }
    case 'sessions_100':
      return { current: Math.min(snap.completedCount, 100), target: 100 }
    case 'streak_4':
      return { current: Math.min(snap.bestStreakWeeks, 4), target: 4 }
    case 'streak_12':
      return { current: Math.min(snap.bestStreakWeeks, 12), target: 12 }
    case 'streak_52':
      return { current: Math.min(snap.bestStreakWeeks, 52), target: 52 }
    case 'goal_pushups_100':
      return { current: Math.min(snap.maxPushups, 100), target: 100 }
    case 'goal_pullups_50':
      return { current: Math.min(snap.maxPullups, 50), target: 50 }
    case 'goal_pullups_30':
      return { current: Math.min(snap.maxPullups, 30), target: 30 }
    case 'pr_repeat_3':
      return { current: Math.min(snap.prRepeatMax, 3), target: 3 }
    case 'trainer_25':
      return { current: Math.min(snap.impact.trainedTotal, 25), target: 25 }
    case 'plan_with_legs':
      return { current: Math.min(snap.impact.bestPlanImports, 5), target: 5 }
    case 'poly_publisher':
      return { current: Math.min(snap.impact.publishedCount, 3), target: 3 }
    case 'legend_quiet_master':
      return { current: Math.min(snap.completedCount, 200), target: 200 }
    case 'secret_night':
    case 'secret_precision':
      return null
    default:
      return null
  }
}
