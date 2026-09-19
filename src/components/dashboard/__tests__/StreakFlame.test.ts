import { describe, expect, it } from 'vitest'
import {
  streakFlameBadgeStyle,
  streakFlameColor,
  streakFlameTier,
} from '@/components/dashboard/StreakFlame'

describe('streakFlameTier', () => {
  it('is unlit with no streak', () => {
    expect(streakFlameTier(0)).toBe(0)
    expect(streakFlameTier(-3)).toBe(0)
  })

  it('ramps up along the streak milestones', () => {
    // Tiers are anchored on STREAK_MILESTONES = [4, 8, 12, 26, 52]
    expect(streakFlameTier(1)).toBe(1)
    expect(streakFlameTier(3)).toBe(1)
    expect(streakFlameTier(4)).toBe(2)
    expect(streakFlameTier(7)).toBe(2)
    expect(streakFlameTier(8)).toBe(3)
    expect(streakFlameTier(11)).toBe(3)
    expect(streakFlameTier(12)).toBe(4)
    expect(streakFlameTier(25)).toBe(4)
    expect(streakFlameTier(26)).toBe(5)
    expect(streakFlameTier(51)).toBe(5)
    expect(streakFlameTier(52)).toBe(6)
    expect(streakFlameTier(200)).toBe(6)
  })
})

describe('streakFlameColor', () => {
  it('is muted for tier 0', () => {
    expect(streakFlameColor(0)).toBe('var(--sr-text-muted)')
  })

  it('gets progressively hotter across tiers', () => {
    const colors = [1, 4, 8, 12, 26, 52].map(streakFlameColor)
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('streakFlameBadgeStyle', () => {
  it('returns nothing for tier 0 so callers keep the neutral badge', () => {
    expect(streakFlameBadgeStyle(0)).toBeUndefined()
  })

  it('tints the badge with the flame color once lit', () => {
    const style = streakFlameBadgeStyle(8)
    expect(style?.color).toBe(streakFlameColor(8))
    expect(String(style?.backgroundColor)).toContain('color-mix')
  })
})
