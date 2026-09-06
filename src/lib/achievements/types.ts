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
  | 'streak_26'
  | 'streak_52'
  | 'comeback_stronger'
  | 'volume_10k'
  | 'first_publish'
  | 'first_like'
  | 'first_import'
  | 'first_trained'
  | 'plan_with_legs'
  | 'trainer_25'
  | 'poly_publisher'
  | 'legend_full_circle'
  | 'legend_quiet_master'
  | 'legend_grandmaster'
  | 'secret_night'
  | 'secret_precision'
  | 'cycles_5'
  | 'custom_sessions_25'
  | 'pr_master'
  | 'habit_builder'
  | 'liked_author'
  | 'imported_author'
  | 'community_pillar'
  | 'custom_creator'
  | 'secret_dawn'
  | 'secret_marathon'
  | 'both_programs'
  // ── New: AI coach ──
  | 'ai_first_insight'
  | 'ai_coach_user'
  // ── New: Custom exercises ──
  | 'exercise_creator'
  // ── New: Body weight tracking ──
  | 'weight_tracker'
  // ── New: Weekend warrior ──
  | 'weekend_warrior'
  // ── New: Follow system ──
  | 'first_follower'
  | 'followed_by_25'
  | 'first_follow'
  // ── New: Community reviews ──
  | 'first_review'
  | 'reviewer_10'
  // ── New: Weekly challenge ──
  | 'challenge_first'
  | 'challenge_winner'
  | 'challenge_5'
  // ── New: Legend ──
  | 'legend_community'
  // ── New: Secret ──
  | 'secret_weekend'

/** Tier definition for progressive achievements. */
export type AchievementTier = {
  /** Numeric threshold that must be met to unlock this tier. */
  threshold: number
  /** Rarity for this tier — higher tiers can be rarer. */
  rarity: AchievementRarity
  /** Optional glyph override per tier (defaults to def.glyph). */
  glyph?: string
}

export type AchievementDef = {
  id: AchievementId
  track: AchievementTrack
  /** Base rarity — used for non-tiered achievements and as fallback. */
  rarity: AchievementRarity
  isSecret?: boolean
  /** Glyph key for AchievementTile. */
  glyph: string
  /** Progressive tiers — when present, the achievement has multiple levels.
   * Tiers must be sorted ascending by threshold. The highest met tier determines
   * the displayed rarity and visual treatment. */
  tiers?: AchievementTier[]
}

/** Resolved tier info for a met achievement (highest unlocked tier). */
export type ResolvedTier = {
  /** 1-based tier index (1 = first tier). 0 = none met. */
  level: number
  /** Total number of tiers for this achievement. */
  maxLevel: number
  /** Rarity of the highest met tier (or base rarity if no tiers). */
  rarity: AchievementRarity
  /** Threshold of the highest met tier. */
  threshold: number
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
  /** Number of users following me. */
  followerCount: number
  /** Number of users I follow. */
  followingCount: number
  /** Number of reviews I have written. */
  reviewCount: number
  /** Number of weekly challenges I participated in. */
  challengeParticipations: number
  /** Number of weekly challenges I won (rank 1). */
  challengeWins: number
}

export type AchievementSnapshot = {
  now: Date
  completedCount: number
  completedInLast14d: number
  customCompletedCount: number
  customHitTargetCount: number
  nightSessionCount: number
  /** Sessions started 5:00–6:59 (dawn). */
  dawnSessionCount: number
  /** Sessions lasting >60 min (completedAt - startedAt). */
  longSessionCount: number
  /** Completed builtin pushups sessions (passed). */
  pushupsSessions: number
  /** Completed builtin pullups sessions (passed). */
  pullupsSessions: number
  /** Number of custom plans created (any status). */
  customPlansCount: number
  streakWeeks: number
  bestStreakWeeks: number
  maxPushups: number
  maxPullups: number
  hasCycleClosedStrong: boolean
  cyclesClosedCount: number
  workshopCustom: boolean
  prRepeatMax: number
  comebackStronger: boolean
  /** All-time total reps across all completed sessions. */
  totalRepsAllTime: number
  /** Number of body weight entries logged. */
  bodyWeightEntries: number
  /** Number of custom exercises created. */
  customExercisesCount: number
  /** Number of AI insights generated (all types). */
  aiInsightCount: number
  /** Number of completed sessions on Saturday or Sunday. */
  weekendSessionCount: number
  impact: AuthorImpactStats
  /** Earliest unlock hint timestamps by achievement id (ISO) */
  unlockAtHints: Partial<Record<AchievementId, string>>
}

export type LocalAchievementUnlock = {
  id: AchievementId
  unlockedAt: string
  seenAt: string | null
  /** Highest tier level unlocked (1-based). Null/0 for non-tiered achievements. */
  tierLevel?: number | null
}

export type EvaluateResult = {
  newlyUnlocked: LocalAchievementUnlock[]
  allUnlocked: LocalAchievementUnlock[]
  backfill: boolean
  /** Unlocks whose tier was upgraded or downgraded (not new). Pushed to cloud but not queued as unlock sheets. */
  tierChanged: LocalAchievementUnlock[]
}
