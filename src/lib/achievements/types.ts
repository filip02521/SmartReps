export type AchievementTrack = 'training' | 'habit' | 'catalog' | 'legend'
export type AchievementRarity = 'common' | 'rare' | 'legendary'

export type AchievementId =
  | 'first_session'
  | 'habit_3_in_14'
  | 'first_custom_session'
  | 'cycle_closed_strong'
  | 'goal_pushups_100'
  | 'goal_pullups_50'
  | 'goal_pullups_30'
  | 'workshop_custom'
  | 'pr_repeat_3'
  | 'sessions_100'
  | 'streak_1'
  | 'streak_4'
  | 'streak_12'
  | 'streak_52'
  | 'comeback_stronger'
  | 'first_publish'
  | 'first_like'
  | 'first_import'
  | 'first_trained'
  | 'plan_with_legs'
  | 'trainer_25'
  | 'poly_publisher'
  | 'legend_full_circle'
  | 'legend_quiet_master'
  | 'secret_night'
  | 'secret_precision'

export type AchievementDef = {
  id: AchievementId
  track: AchievementTrack
  rarity: AchievementRarity
  isSecret?: boolean
  /** Glyph key for AchievementTile */
  glyph: string
}

export type AchievementProgress = {
  current: number
  target: number
} | null

export type AuthorImpactStats = {
  likeTotal: number
  importTotal: number
  trainedTotal: number
  publishedCount: number
  /** Best single publication: imports + trained */
  bestPlanImports: number
  bestPlanTrained: number
}

export type AchievementSnapshot = {
  now: Date
  completedCount: number
  completedInLast14d: number
  customCompletedCount: number
  customHitTargetCount: number
  nightSessionCount: number
  streakWeeks: number
  bestStreakWeeks: number
  maxPushups: number
  maxPullups: number
  hasCycleClosedStrong: boolean
  workshopCustom: boolean
  prRepeatMax: number
  comebackStronger: boolean
  impact: AuthorImpactStats
  /** Earliest unlock hint timestamps by achievement id (ISO) */
  unlockAtHints: Partial<Record<AchievementId, string>>
}

export type LocalAchievementUnlock = {
  id: AchievementId
  unlockedAt: string
  seenAt: string | null
}

export type EvaluateResult = {
  newlyUnlocked: LocalAchievementUnlock[]
  allUnlocked: LocalAchievementUnlock[]
  backfill: boolean
}
