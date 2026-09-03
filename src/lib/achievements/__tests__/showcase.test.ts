import { describe, expect, it, beforeEach } from 'vitest'
import {
  getShowcasePinnedIds,
  rankUnlocksForShowcase,
  resolveShowcaseSlots,
  setShowcasePinnedIds,
} from '@/lib/achievements/showcase'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'

describe('achievement showcase', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('auto-picks legendary before common and newer within rarity', () => {
    const unlocks: LocalAchievementUnlock[] = [
      { id: 'first_session', unlockedAt: '2026-03-01T00:00:00.000Z', seenAt: null },
      { id: 'sessions_100', unlockedAt: '2026-01-01T00:00:00.000Z', seenAt: null },
      { id: 'streak_4', unlockedAt: '2026-02-01T00:00:00.000Z', seenAt: null },
      { id: 'goal_pushups_100', unlockedAt: '2026-02-15T00:00:00.000Z', seenAt: null },
    ]
    expect(rankUnlocksForShowcase(unlocks).map((u) => u.id)).toEqual([
      'goal_pushups_100',
      'sessions_100',
      'streak_4',
      'first_session',
    ])
    expect(resolveShowcaseSlots(unlocks, null)).toEqual([
      'goal_pushups_100',
      'sessions_100',
      'streak_4',
      'first_session',
    ])
  })

  it('uses pinned order and drops ids that are not unlocked', () => {
    const unlocks: LocalAchievementUnlock[] = [
      { id: 'first_session', unlockedAt: '2026-01-01T00:00:00.000Z', seenAt: null },
      { id: 'streak_1', unlockedAt: '2026-01-02T00:00:00.000Z', seenAt: null },
    ]
    expect(
      resolveShowcaseSlots(unlocks, ['streak_1', 'sessions_100', 'first_session']),
    ).toEqual(['streak_1', 'first_session', null, null])
  })

  it('persists manual pins and restores auto with null', () => {
    expect(getShowcasePinnedIds()).toBeNull()
    setShowcasePinnedIds(['first_session', 'streak_1'])
    expect(getShowcasePinnedIds()).toEqual(['first_session', 'streak_1'])
    setShowcasePinnedIds(null)
    expect(getShowcasePinnedIds()).toBeNull()
  })
})
