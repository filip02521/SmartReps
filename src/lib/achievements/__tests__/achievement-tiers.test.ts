import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENT_BY_ID,
  isAchievementMet,
  achievementProgress,
  resolveTier,
  resolveDisplayRarity,
  resolveDisplayGlyph,
  hasNextTier,
} from '@/lib/achievements/catalog'
import type { AchievementSnapshot } from '@/lib/achievements/types'
import { emptyImpact } from '@/lib/achievements/snapshot'

function baseSnap(over: Partial<AchievementSnapshot> = {}): AchievementSnapshot {
  return {
    now: new Date('2026-03-15T12:00:00'),
    completedCount: 0,
    completedInLast14d: 0,
    customCompletedCount: 0,
    customHitTargetCount: 0,
    nightSessionCount: 0,
    dawnSessionCount: 0,
    longSessionCount: 0,
    pushupsSessions: 0,
    pullupsSessions: 0,
    customPlansCount: 0,
    streakWeeks: 0,
    bestStreakWeeks: 0,
    maxPushups: 0,
    maxPullups: 0,
    hasCycleClosedStrong: false,
    cyclesClosedCount: 0,
    workshopCustom: false,
    prRepeatMax: 0,
    comebackStronger: false,
    totalRepsAllTime: 0,
    bodyWeightEntries: 0,
    customExercisesCount: 0,
    aiInsightCount: 0,
    weekendSessionCount: 0,
    impact: emptyImpact(),
    unlockAtHints: {},
    ...over,
  }
}

describe('achievement tiers — progressive system', () => {
  it('sessions_100 has 4 tiers (100/250/500/1000)', () => {
    const def = ACHIEVEMENT_BY_ID['sessions_100']
    expect(def.tiers).toBeDefined()
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![0]!.threshold).toBe(100)
    expect(def.tiers![3]!.threshold).toBe(1000)
  })

  it('isAchievementMet returns true when first tier is met', () => {
    expect(isAchievementMet('sessions_100', baseSnap({ completedCount: 100 }))).toBe(true)
    expect(isAchievementMet('sessions_100', baseSnap({ completedCount: 99 }))).toBe(false)
  })

  it('resolveTier returns correct level for partial tier progress', () => {
    const def = ACHIEVEMENT_BY_ID['sessions_100']
    // 250 sessions → tier 2
    expect(resolveTier(def, baseSnap({ completedCount: 250 }))?.level).toBe(2)
    // 500 sessions → tier 3
    expect(resolveTier(def, baseSnap({ completedCount: 500 }))?.level).toBe(3)
    // 1000 sessions → tier 4 (max)
    expect(resolveTier(def, baseSnap({ completedCount: 1000 }))?.level).toBe(4)
    // 150 sessions → tier 1
    expect(resolveTier(def, baseSnap({ completedCount: 150 }))?.level).toBe(1)
  })

  it('achievementProgress shows next tier target for tiered achievements', () => {
    // 150 sessions → progress toward tier 2 (250)
    const p = achievementProgress('sessions_100', baseSnap({ completedCount: 150 }))
    expect(p).toEqual({ current: 150, target: 250 })
  })

  it('achievementProgress shows complete when all tiers met', () => {
    const p = achievementProgress('sessions_100', baseSnap({ completedCount: 1500 }))
    expect(p).toEqual({ current: 1000, target: 1000 })
  })

  it('volume_10k has 4 tiers (10k/50k/100k/250k)', () => {
    const def = ACHIEVEMENT_BY_ID['volume_10k']
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![0]!.threshold).toBe(10000)
    expect(def.tiers![3]!.threshold).toBe(250000)
  })

  it('volume_10k unlocks at 10k reps', () => {
    expect(isAchievementMet('volume_10k', baseSnap({ totalRepsAllTime: 10000 }))).toBe(true)
    expect(isAchievementMet('volume_10k', baseSnap({ totalRepsAllTime: 9999 }))).toBe(false)
  })

  it('streak_52 has 2 tiers (52/104 weeks)', () => {
    const def = ACHIEVEMENT_BY_ID['streak_52']
    expect(def.tiers).toHaveLength(2)
    expect(def.tiers![1]!.threshold).toBe(104)
  })

  it('secret_night has 3 tiers (10/50/100)', () => {
    const def = ACHIEVEMENT_BY_ID['secret_night']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(10)
    expect(def.tiers![2]!.threshold).toBe(100)
  })

  it('resolveDisplayRarity uses tier level when provided', () => {
    const def = ACHIEVEMENT_BY_ID['sessions_100']
    // Tier 1 (100 sessions) → rare
    expect(resolveDisplayRarity(def, null, 1)).toBe('rare')
    // Tier 2 (250 sessions) → legendary
    expect(resolveDisplayRarity(def, null, 2)).toBe('legendary')
    // Tier 4 (1000 sessions) → legendary
    expect(resolveDisplayRarity(def, null, 4)).toBe('legendary')
  })

  it('resolveDisplayGlyph returns tier-specific glyph', () => {
    const def = ACHIEVEMENT_BY_ID['sessions_100']
    expect(resolveDisplayGlyph(def, 1)).toBe('layers')
    expect(resolveDisplayGlyph(def, 3)).toBe('layers-gold')
    expect(resolveDisplayGlyph(def, 4)).toBe('layers-diamond')
  })

  it('hasNextTier detects available higher tiers', () => {
    const def = ACHIEVEMENT_BY_ID['sessions_100']
    // Currently at tier 1, 250 sessions met → has next tier
    expect(
      hasNextTier(def, 1, baseSnap({ completedCount: 250 })),
    ).toBe(true)
    // Currently at tier 4, no higher tier
    expect(
      hasNextTier(def, 4, baseSnap({ completedCount: 1500 })),
    ).toBe(false)
  })

  it('cycles_5 unlocks at 5 closed cycles', () => {
    expect(isAchievementMet('cycles_5', baseSnap({ cyclesClosedCount: 5 }))).toBe(true)
    expect(isAchievementMet('cycles_5', baseSnap({ cyclesClosedCount: 4 }))).toBe(false)
  })

  it('legend_grandmaster requires 1000 sessions AND 104 week streak', () => {
    expect(
      isAchievementMet(
        'legend_grandmaster',
        baseSnap({ completedCount: 1000, bestStreakWeeks: 104 }),
      ),
    ).toBe(true)
    expect(
      isAchievementMet(
        'legend_grandmaster',
        baseSnap({ completedCount: 1000, bestStreakWeeks: 103 }),
      ),
    ).toBe(false)
  })

  it('non-tiered achievements still work (first_session)', () => {
    expect(isAchievementMet('first_session', baseSnap({ completedCount: 1 }))).toBe(true)
    expect(resolveTier(ACHIEVEMENT_BY_ID['first_session'], baseSnap({ completedCount: 1 }))).toBeNull()
  })

  it('legend_quiet_master has 3 tiers (200/500/1000)', () => {
    const def = ACHIEVEMENT_BY_ID['legend_quiet_master']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(200)
    expect(def.tiers![2]!.threshold).toBe(1000)
  })

  it('streak_26 is a standalone achievement (not tiered)', () => {
    const def = ACHIEVEMENT_BY_ID['streak_26']
    expect(def.tiers).toBeUndefined()
    expect(isAchievementMet('streak_26', baseSnap({ bestStreakWeeks: 26 }))).toBe(true)
  })

  // ── New long-distance achievements ──

  it('custom_sessions_25 has 4 tiers (25/50/100/250)', () => {
    const def = ACHIEVEMENT_BY_ID['custom_sessions_25']
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![0]!.threshold).toBe(25)
    expect(def.tiers![3]!.threshold).toBe(250)
  })

  it('custom_sessions_25 unlocks at 25 custom sessions', () => {
    expect(isAchievementMet('custom_sessions_25', baseSnap({ customCompletedCount: 25 }))).toBe(true)
    expect(isAchievementMet('custom_sessions_25', baseSnap({ customCompletedCount: 24 }))).toBe(false)
  })

  it('pr_master has 3 tiers (5/10/20)', () => {
    const def = ACHIEVEMENT_BY_ID['pr_master']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(5)
    expect(def.tiers![2]!.threshold).toBe(20)
  })

  it('pr_master unlocks at 5 PR sessions', () => {
    expect(isAchievementMet('pr_master', baseSnap({ prRepeatMax: 5 }))).toBe(true)
    expect(isAchievementMet('pr_master', baseSnap({ prRepeatMax: 4 }))).toBe(false)
  })

  it('habit_builder has 4 tiers (4/5/6/8 sessions in 14 days)', () => {
    const def = ACHIEVEMENT_BY_ID['habit_builder']
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![0]!.threshold).toBe(4)
    expect(def.tiers![3]!.threshold).toBe(8)
  })

  it('habit_builder unlocks at 4 sessions in 14 days', () => {
    expect(isAchievementMet('habit_builder', baseSnap({ completedInLast14d: 4 }))).toBe(true)
    expect(isAchievementMet('habit_builder', baseSnap({ completedInLast14d: 3 }))).toBe(false)
  })

  it('liked_author has 4 tiers (10/50/100/250)', () => {
    const def = ACHIEVEMENT_BY_ID['liked_author']
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![0]!.threshold).toBe(10)
    expect(def.tiers![3]!.threshold).toBe(250)
  })

  it('liked_author unlocks at 10 likes', () => {
    expect(
      isAchievementMet('liked_author', baseSnap({ impact: { ...emptyImpact(), likeTotal: 10 } })),
    ).toBe(true)
    expect(
      isAchievementMet('liked_author', baseSnap({ impact: { ...emptyImpact(), likeTotal: 9 } })),
    ).toBe(false)
  })

  it('imported_author has 4 tiers (10/50/100/250)', () => {
    const def = ACHIEVEMENT_BY_ID['imported_author']
    expect(def.tiers).toHaveLength(4)
    expect(def.tiers![3]!.threshold).toBe(250)
  })

  it('community_pillar has 3 tiers (5/10/25 publications)', () => {
    const def = ACHIEVEMENT_BY_ID['community_pillar']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(5)
    expect(def.tiers![2]!.threshold).toBe(25)
  })

  it('custom_creator has 3 tiers (3/10/25 plans)', () => {
    const def = ACHIEVEMENT_BY_ID['custom_creator']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(3)
    expect(def.tiers![2]!.threshold).toBe(25)
  })

  it('custom_creator unlocks at 3 custom plans', () => {
    expect(isAchievementMet('custom_creator', baseSnap({ customPlansCount: 3 }))).toBe(true)
    expect(isAchievementMet('custom_creator', baseSnap({ customPlansCount: 2 }))).toBe(false)
  })

  it('both_programs requires ≥10 pushups AND ≥10 pullups sessions', () => {
    expect(
      isAchievementMet('both_programs', baseSnap({ pushupsSessions: 10, pullupsSessions: 10 })),
    ).toBe(true)
    expect(
      isAchievementMet('both_programs', baseSnap({ pushupsSessions: 10, pullupsSessions: 9 })),
    ).toBe(false)
    expect(
      isAchievementMet('both_programs', baseSnap({ pushupsSessions: 9, pullupsSessions: 10 })),
    ).toBe(false)
  })

  it('both_programs is not tiered', () => {
    const def = ACHIEVEMENT_BY_ID['both_programs']
    expect(def.tiers).toBeUndefined()
  })

  it('secret_dawn has 3 tiers (10/50/100)', () => {
    const def = ACHIEVEMENT_BY_ID['secret_dawn']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(10)
    expect(def.tiers![2]!.threshold).toBe(100)
    expect(def.isSecret).toBe(true)
  })

  it('secret_dawn unlocks at 10 dawn sessions', () => {
    expect(isAchievementMet('secret_dawn', baseSnap({ dawnSessionCount: 10 }))).toBe(true)
    expect(isAchievementMet('secret_dawn', baseSnap({ dawnSessionCount: 9 }))).toBe(false)
  })

  it('secret_marathon has 3 tiers (10/50/100)', () => {
    const def = ACHIEVEMENT_BY_ID['secret_marathon']
    expect(def.tiers).toHaveLength(3)
    expect(def.tiers![0]!.threshold).toBe(10)
    expect(def.tiers![2]!.threshold).toBe(100)
    expect(def.isSecret).toBe(true)
  })

  it('secret_marathon unlocks at 10 long sessions', () => {
    expect(isAchievementMet('secret_marathon', baseSnap({ longSessionCount: 10 }))).toBe(true)
    expect(isAchievementMet('secret_marathon', baseSnap({ longSessionCount: 9 }))).toBe(false)
  })
})
