import type {
  AchievementDef,
  AchievementId,
  AchievementSnapshot,
  AchievementProgress,
  AchievementRarity,
  AchievementTier,
  ResolvedTier,
} from './types'

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  // ── Training ──
  { id: 'first_session', track: 'training', rarity: 'common', glyph: 'dumbbell' },
  { id: 'habit_3_in_14', track: 'training', rarity: 'common', glyph: 'target' },
  { id: 'first_custom_session', track: 'training', rarity: 'common', glyph: 'list' },
  { id: 'cycle_closed_strong', track: 'training', rarity: 'rare', glyph: 'flag' },
  { id: 'goal_pullups_30', track: 'training', rarity: 'rare', glyph: 'pull' },
  { id: 'workshop_custom', track: 'training', rarity: 'rare', glyph: 'wrench' },
  { id: 'pr_repeat_3', track: 'training', rarity: 'rare', glyph: 'trending' },
  {
    id: 'goal_pushups_100',
    track: 'training',
    rarity: 'legendary',
    glyph: 'hundred',
    tiers: [
      { threshold: 100, rarity: 'rare' },
      { threshold: 150, rarity: 'legendary' },
      { threshold: 200, rarity: 'legendary', glyph: 'hundred-gold' },
    ],
  },
  {
    id: 'goal_pullups_50',
    track: 'training',
    rarity: 'legendary',
    glyph: 'pull50',
    tiers: [
      { threshold: 50, rarity: 'rare' },
      { threshold: 75, rarity: 'legendary' },
      { threshold: 100, rarity: 'legendary', glyph: 'pull50-gold' },
    ],
  },
  {
    id: 'sessions_100',
    track: 'training',
    rarity: 'legendary',
    glyph: 'layers',
    tiers: [
      { threshold: 100, rarity: 'rare' },
      { threshold: 250, rarity: 'legendary' },
      { threshold: 500, rarity: 'legendary', glyph: 'layers-gold' },
      { threshold: 1000, rarity: 'legendary', glyph: 'layers-diamond' },
    ],
  },

  // ── Habit / Streak ──
  { id: 'streak_1', track: 'habit', rarity: 'common', glyph: 'calendar' },
  { id: 'streak_4', track: 'habit', rarity: 'rare', glyph: 'calendar' },
  { id: 'streak_12', track: 'habit', rarity: 'rare', glyph: 'flame' },
  { id: 'streak_26', track: 'habit', rarity: 'legendary', glyph: 'flame' },
  {
    id: 'streak_52',
    track: 'habit',
    rarity: 'legendary',
    glyph: 'crown',
    tiers: [
      { threshold: 52, rarity: 'legendary' },
      { threshold: 104, rarity: 'legendary', glyph: 'crown-diamond' },
    ],
  },
  { id: 'comeback_stronger', track: 'habit', rarity: 'legendary', glyph: 'refresh' },

  // ── Volume (all-time reps) ──
  {
    id: 'volume_10k',
    track: 'training',
    rarity: 'common',
    glyph: 'bar-chart',
    tiers: [
      { threshold: 10000, rarity: 'common' },
      { threshold: 50000, rarity: 'rare', glyph: 'bar-chart' },
      { threshold: 100000, rarity: 'legendary', glyph: 'bar-chart-gold' },
      { threshold: 250000, rarity: 'legendary', glyph: 'bar-chart-diamond' },
    ],
  },

  // ── Cycles closed ──
  {
    id: 'cycles_5',
    track: 'training',
    rarity: 'rare',
    glyph: 'flag',
    tiers: [
      { threshold: 5, rarity: 'common' },
      { threshold: 10, rarity: 'rare' },
      { threshold: 25, rarity: 'legendary', glyph: 'flag-diamond' },
    ],
  },

  // ── Catalog ──
  { id: 'first_publish', track: 'catalog', rarity: 'common', glyph: 'upload' },
  { id: 'first_like', track: 'catalog', rarity: 'common', glyph: 'heart' },
  { id: 'first_import', track: 'catalog', rarity: 'rare', glyph: 'download' },
  { id: 'first_trained', track: 'catalog', rarity: 'rare', glyph: 'users' },
  { id: 'plan_with_legs', track: 'catalog', rarity: 'rare', glyph: 'footprints' },
  {
    id: 'trainer_25',
    track: 'catalog',
    rarity: 'legendary',
    glyph: 'users',
    tiers: [
      { threshold: 25, rarity: 'common' },
      { threshold: 100, rarity: 'legendary', glyph: 'users-gold' },
    ],
  },
  { id: 'poly_publisher', track: 'catalog', rarity: 'legendary', glyph: 'library' },

  // ── Legend ──
  { id: 'legend_full_circle', track: 'legend', rarity: 'legendary', glyph: 'logo' },
  {
    id: 'legend_quiet_master',
    track: 'legend',
    rarity: 'legendary',
    glyph: 'shield',
    tiers: [
      { threshold: 200, rarity: 'rare' },
      { threshold: 500, rarity: 'legendary', glyph: 'shield-gold' },
      { threshold: 1000, rarity: 'legendary', glyph: 'shield-gold' },
    ],
  },
  { id: 'legend_grandmaster', track: 'legend', rarity: 'legendary', glyph: 'crown' },

  // ── Secret (progressive) ──
  {
    id: 'secret_night',
    track: 'legend',
    rarity: 'legendary',
    isSecret: true,
    glyph: 'moon',
    tiers: [
      { threshold: 10, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'legendary', glyph: 'moon-diamond' },
    ],
  },
  {
    id: 'secret_precision',
    track: 'legend',
    rarity: 'legendary',
    isSecret: true,
    glyph: 'crosshair',
    tiers: [
      { threshold: 20, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'legendary', glyph: 'crosshair-diamond' },
    ],
  },

  // ── Custom sessions volume (progressive) ──
  {
    id: 'custom_sessions_25',
    track: 'training',
    rarity: 'rare',
    glyph: 'list',
    tiers: [
      { threshold: 25, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'rare' },
      { threshold: 250, rarity: 'legendary', glyph: 'list' },
    ],
  },

  // ── PR master (progressive) ──
  {
    id: 'pr_master',
    track: 'training',
    rarity: 'legendary',
    glyph: 'trending',
    tiers: [
      { threshold: 5, rarity: 'common' },
      { threshold: 10, rarity: 'rare' },
      { threshold: 20, rarity: 'legendary', glyph: 'trending' },
    ],
  },

  // ── Habit builder (progressive) ──
  {
    id: 'habit_builder',
    track: 'habit',
    rarity: 'rare',
    glyph: 'target',
    tiers: [
      { threshold: 4, rarity: 'common' },
      { threshold: 5, rarity: 'rare' },
      { threshold: 6, rarity: 'rare' },
      { threshold: 8, rarity: 'legendary' },
    ],
  },

  // ── Community impact (progressive) ──
  {
    id: 'liked_author',
    track: 'catalog',
    rarity: 'rare',
    glyph: 'heart',
    tiers: [
      { threshold: 10, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'rare' },
      { threshold: 250, rarity: 'legendary', glyph: 'heart' },
    ],
  },
  {
    id: 'imported_author',
    track: 'catalog',
    rarity: 'rare',
    glyph: 'download',
    tiers: [
      { threshold: 10, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'rare' },
      { threshold: 250, rarity: 'legendary', glyph: 'download' },
    ],
  },
  {
    id: 'community_pillar',
    track: 'catalog',
    rarity: 'legendary',
    glyph: 'library',
    tiers: [
      { threshold: 5, rarity: 'common' },
      { threshold: 10, rarity: 'rare' },
      { threshold: 25, rarity: 'legendary', glyph: 'library' },
    ],
  },

  // ── Custom plan creator (progressive) ──
  {
    id: 'custom_creator',
    track: 'training',
    rarity: 'rare',
    glyph: 'wrench',
    tiers: [
      { threshold: 3, rarity: 'common' },
      { threshold: 10, rarity: 'rare' },
      { threshold: 25, rarity: 'legendary', glyph: 'wrench' },
    ],
  },

  // ── Both programs (compound) ──
  { id: 'both_programs', track: 'training', rarity: 'rare', glyph: 'dumbbell' },

  // ── Secret dawn (progressive) ──
  {
    id: 'secret_dawn',
    track: 'legend',
    rarity: 'legendary',
    isSecret: true,
    glyph: 'flame',
    tiers: [
      { threshold: 10, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'legendary', glyph: 'flame' },
    ],
  },

  // ── Secret marathon (progressive) ──
  {
    id: 'secret_marathon',
    track: 'legend',
    rarity: 'legendary',
    isSecret: true,
    glyph: 'layers',
    tiers: [
      { threshold: 10, rarity: 'common' },
      { threshold: 50, rarity: 'rare' },
      { threshold: 100, rarity: 'legendary', glyph: 'layers' },
    ],
  },
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENT_CATALOG.map((a) => [a.id, a]),
) as Record<AchievementId, AchievementDef>

/** Raw metric value for an achievement — the number compared against tier thresholds. */
function achievementMetricValue(id: AchievementId, snap: AchievementSnapshot): number {
  switch (id) {
    case 'first_session':
      return snap.completedCount
    case 'habit_3_in_14':
      return snap.completedInLast14d
    case 'first_custom_session':
      return snap.customCompletedCount
    case 'cycle_closed_strong':
      return snap.hasCycleClosedStrong ? 1 : 0
    case 'goal_pushups_100':
      return snap.maxPushups
    case 'goal_pullups_50':
    case 'goal_pullups_30':
      return snap.maxPullups
    case 'workshop_custom':
      return snap.workshopCustom ? 1 : 0
    case 'pr_repeat_3':
      return snap.prRepeatMax
    case 'sessions_100':
      return snap.completedCount
    case 'streak_1':
      return snap.streakWeeks
    case 'streak_4':
    case 'streak_12':
    case 'streak_26':
    case 'streak_52':
      return snap.bestStreakWeeks
    case 'comeback_stronger':
      return snap.comebackStronger ? 1 : 0
    case 'volume_10k':
      return snap.totalRepsAllTime
    case 'cycles_5':
      return snap.cyclesClosedCount
    case 'first_publish':
      return snap.impact.publishedCount
    case 'first_like':
      return snap.impact.likeTotal
    case 'first_import':
      return snap.impact.importTotal
    case 'first_trained':
      return snap.impact.trainedTotal
    case 'plan_with_legs':
      return snap.impact.bestPlanImports >= 5 && snap.impact.bestPlanTrained >= 1 ? 1 : 0
    case 'trainer_25':
      return snap.impact.trainedTotal
    case 'poly_publisher':
      return snap.impact.publishedCount >= 3 && snap.impact.importTotal >= 10 ? 1 : 0
    case 'legend_full_circle':
      return (snap.maxPushups >= 100 || snap.maxPullups >= 50) &&
        snap.bestStreakWeeks >= 12 &&
        snap.impact.trainedTotal >= 1
        ? 1
        : 0
    case 'legend_quiet_master':
      return snap.completedCount
    case 'legend_grandmaster':
      return snap.completedCount >= 1000 && snap.bestStreakWeeks >= 104 ? 1 : 0
    case 'secret_night':
      return snap.nightSessionCount
    case 'secret_precision':
      return snap.customHitTargetCount
    case 'custom_sessions_25':
      return snap.customCompletedCount
    case 'pr_master':
      return snap.prRepeatMax
    case 'habit_builder':
      return snap.completedInLast14d
    case 'liked_author':
      return snap.impact.likeTotal
    case 'imported_author':
      return snap.impact.importTotal
    case 'community_pillar':
      return snap.impact.publishedCount
    case 'custom_creator':
      return snap.customPlansCount
    case 'both_programs':
      return snap.pushupsSessions >= 10 && snap.pullupsSessions >= 10 ? 1 : 0
    case 'secret_dawn':
      return snap.dawnSessionCount
    case 'secret_marathon':
      return snap.longSessionCount
    default:
      return 0
  }
}

/** Base threshold for non-tiered achievements only. Tiered achievements use their tiers array. */
function achievementBaseThreshold(id: AchievementId): number {
  switch (id) {
    case 'first_session':
    case 'first_custom_session':
    case 'cycle_closed_strong':
    case 'workshop_custom':
    case 'comeback_stronger':
    case 'plan_with_legs':
    case 'poly_publisher':
    case 'legend_full_circle':
    case 'legend_grandmaster':
    case 'both_programs':
      return 1
    case 'habit_3_in_14':
      return 3
    case 'goal_pullups_30':
      return 30
    case 'pr_repeat_3':
      return 3
    case 'streak_1':
      return 1
    case 'streak_4':
      return 4
    case 'streak_12':
      return 12
    case 'streak_26':
      return 26
    case 'first_publish':
    case 'first_like':
    case 'first_import':
    case 'first_trained':
      return 1
    default:
      return Infinity
  }
}

/** Resolve the highest met tier for a tiered achievement. Returns null for non-tiered. */
export function resolveTier(
  def: AchievementDef,
  snap: AchievementSnapshot,
): ResolvedTier | null {
  if (!def.tiers || def.tiers.length === 0) return null
  const value = achievementMetricValue(def.id, snap)
  let metLevel = 0
  let metTier: AchievementTier | null = null
  for (let i = 0; i < def.tiers.length; i++) {
    if (value >= def.tiers[i]!.threshold) {
      metLevel = i + 1
      metTier = def.tiers[i]!
    } else {
      break
    }
  }
  if (metLevel === 0 || !metTier) {
    return {
      level: 0,
      maxLevel: def.tiers.length,
      rarity: def.rarity,
      threshold: def.tiers[0]?.threshold ?? 0,
    }
  }
  return {
    level: metLevel,
    maxLevel: def.tiers.length,
    rarity: metTier.rarity,
    threshold: metTier.threshold,
  }
}

/** Whether at least the first tier (or base threshold) is met. */
export function isAchievementMet(id: AchievementId, snap: AchievementSnapshot): boolean {
  const def = ACHIEVEMENT_BY_ID[id]
  if (!def) return false
  if (def.tiers && def.tiers.length > 0) {
    const value = achievementMetricValue(id, snap)
    return value >= def.tiers[0]!.threshold
  }
  return achievementMetricValue(id, snap) >= achievementBaseThreshold(id)
}

/** Whether a higher tier is available beyond the currently unlocked level. */
export function hasNextTier(
  def: AchievementDef,
  currentTierLevel: number | null | undefined,
  snap: AchievementSnapshot,
): boolean {
  if (!def.tiers || def.tiers.length === 0) return false
  const resolved = resolveTier(def, snap)
  if (!resolved) return false
  return resolved.level > (currentTierLevel ?? 0)
}

/** Resolve the rarity to display: highest met tier rarity, or base rarity.
 *  When unlockedTierLevel is provided, uses that tier's rarity directly. */
export function resolveDisplayRarity(
  def: AchievementDef,
  snap: AchievementSnapshot | null,
  unlockedTierLevel?: number | null,
): AchievementRarity {
  if (!def.tiers || def.tiers.length === 0) return def.rarity
  // If unlocked with a tier level, show that tier's rarity
  if (unlockedTierLevel && unlockedTierLevel > 0) {
    const tier = def.tiers[unlockedTierLevel - 1]
    if (tier) return tier.rarity
  }
  // Otherwise show highest met tier rarity (for locked display)
  if (!snap) return def.rarity
  const resolved = resolveTier(def, snap)
  if (resolved && resolved.level > 0) return resolved.rarity
  return def.rarity
}

/** Resolve the glyph to display for the current tier. */
export function resolveDisplayGlyph(
  def: AchievementDef,
  tierLevel?: number | null,
): string {
  if (!def.tiers || def.tiers.length === 0 || !tierLevel || tierLevel <= 0) return def.glyph
  const tier = def.tiers[tierLevel - 1]
  return tier?.glyph ?? def.glyph
}

export function achievementProgress(
  id: AchievementId,
  snap: AchievementSnapshot,
): AchievementProgress {
  const def = ACHIEVEMENT_BY_ID[id]
  if (!def) return null

  // For tiered achievements, progress toward the NEXT unmet tier
  if (def.tiers && def.tiers.length > 0) {
    const value = achievementMetricValue(id, snap)
    // Find the first tier not yet met
    const nextTier = def.tiers.find((t) => value < t.threshold)
    if (!nextTier) {
      // All tiers met — show last tier as complete
      const last = def.tiers[def.tiers.length - 1]!
      return { current: last.threshold, target: last.threshold }
    }
    return { current: Math.min(value, nextTier.threshold), target: nextTier.threshold }
  }

  // Legacy non-tiered progress
  const value = achievementMetricValue(id, snap)
  const target = achievementBaseThreshold(id)
  if (target === Infinity) return null
  return { current: Math.min(value, target), target }
}
