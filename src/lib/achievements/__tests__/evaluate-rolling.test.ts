import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AchievementSnapshot, LocalAchievementUnlock, AchievementId } from '@/lib/achievements/types'
import { emptyImpact } from '@/lib/achievements/snapshot'

// Mock store — evaluateAchievements reads/writes unlocks through these
const unlocks = new Map<AchievementId, LocalAchievementUnlock>()
const putUnlock = vi.fn((row: LocalAchievementUnlock) => { unlocks.set(row.id, row) })
const deleteUnlock = vi.fn((id: AchievementId) => { unlocks.delete(id) })
const getAllUnlocks = vi.fn(() => Promise.resolve([...unlocks.values()]))
const suppressedSet = new Set<AchievementId>()

vi.mock('@/lib/achievements/store', () => ({
  getAllUnlocks: () => getAllUnlocks(),
  putUnlock: (row: LocalAchievementUnlock) => putUnlock(row),
  deleteUnlock: (id: AchievementId) => deleteUnlock(id),
  hasBackfillFlag: () => true,
  setBackfillFlag: () => undefined,
  getSuppressedAchievements: () => suppressedSet,
}))

import { evaluateAchievements } from '@/lib/achievements/evaluate'

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
    squatsSessions: 0,
    customPlansCount: 0,
    streakWeeks: 0,
    bestStreakWeeks: 0,
    maxPushups: 0,
    maxPullups: 0,
    maxSquats: 0,
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

beforeEach(() => {
  unlocks.clear()
  suppressedSet.clear()
  putUnlock.mockClear()
  deleteUnlock.mockClear()
  getAllUnlocks.mockClear()
})

describe('evaluateAchievements — rolling-window revocation', () => {
  it('revokes habit_builder when completedInLast14d drops below 4', async () => {
    // Simulate: habit_builder was unlocked at tier 1 (4 sessions in 14 days)
    unlocks.set('habit_builder', {
      id: 'habit_builder',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: 1,
    })

    // Now only 2 sessions in last 14 days — below threshold
    const snap = baseSnap({ completedInLast14d: 2 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).toContain('habit_builder')
    expect(deleteUnlock).toHaveBeenCalledWith('habit_builder')
    expect(unlocks.has('habit_builder')).toBe(false)
  })

  it('revokes habit_3_in_14 when completedInLast14d drops below 3', async () => {
    unlocks.set('habit_3_in_14', {
      id: 'habit_3_in_14',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: null,
    })

    const snap = baseSnap({ completedInLast14d: 2 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).toContain('habit_3_in_14')
    expect(deleteUnlock).toHaveBeenCalledWith('habit_3_in_14')
  })

  it('revokes streak_1 when streakWeeks drops to 0', async () => {
    unlocks.set('streak_1', {
      id: 'streak_1',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: null,
    })

    const snap = baseSnap({ streakWeeks: 0 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).toContain('streak_1')
    expect(deleteUnlock).toHaveBeenCalledWith('streak_1')
  })

  it('does NOT revoke habit_builder when criteria still met', async () => {
    unlocks.set('habit_builder', {
      id: 'habit_builder',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: 2,
    })

    // 5 sessions in 14 days — tier 2 (threshold 5) still met
    const snap = baseSnap({ completedInLast14d: 5 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).not.toContain('habit_builder')
    expect(deleteUnlock).not.toHaveBeenCalledWith('habit_builder')
  })

  it('does NOT revoke non-rolling achievements when metric drops', async () => {
    // first_session is cumulative — once earned, always earned
    unlocks.set('first_session', {
      id: 'first_session',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: null,
    })

    // completedCount is 0 (e.g. after clearing data) — but first_session should stay
    const snap = baseSnap({ completedCount: 0 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).not.toContain('first_session')
    expect(deleteUnlock).not.toHaveBeenCalledWith('first_session')
  })

  it('does NOT revoke streak_4 (uses bestStreakWeeks, not rolling)', async () => {
    unlocks.set('streak_4', {
      id: 'streak_4',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: null,
    })

    // Current streak is 0, but best streak was 4 — streak_4 uses bestStreakWeeks
    const snap = baseSnap({ streakWeeks: 0, bestStreakWeeks: 4 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).not.toContain('streak_4')
    expect(deleteUnlock).not.toHaveBeenCalledWith('streak_4')
  })

  it('re-unlocks rolling achievement when criteria are met again after revocation', async () => {
    // habit_builder was revoked (not in unlocks map)
    // Now 4 sessions in 14 days — should re-unlock
    const snap = baseSnap({ completedInLast14d: 4 })
    const result = await evaluateAchievements(snap)

    expect(result.newlyUnlocked.some((u) => u.id === 'habit_builder')).toBe(true)
    expect(unlocks.has('habit_builder')).toBe(true)
  })

  it('downgrades habit_builder tier when sessions decrease but stay above threshold', async () => {
    unlocks.set('habit_builder', {
      id: 'habit_builder',
      unlockedAt: '2026-03-01T10:00:00Z',
      seenAt: '2026-03-01T10:00:00Z',
      tierLevel: 4, // tier 4 = 8 sessions
    })

    // Now 5 sessions — tier 2 (threshold 5), should downgrade from 4 to 2
    const snap = baseSnap({ completedInLast14d: 5 })
    const result = await evaluateAchievements(snap)

    expect(result.revoked).not.toContain('habit_builder')
    expect(result.tierChanged.some((u) => u.id === 'habit_builder' && u.tierLevel === 2)).toBe(true)
  })
})
