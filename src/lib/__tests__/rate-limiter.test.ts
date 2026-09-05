import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  getRemainingQuota,
  getCooldownRemaining,
  formatCooldownRemaining,
  resetRateLimit,
  type AiFeature,
} from '../ai/rate-limiter'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock window for safety listeners
Object.defineProperty(globalThis, 'window', {
  value: {
    addEventListener: vi.fn(),
  },
  writable: true,
})

describe('rate-limiter', () => {
  beforeEach(() => {
    localStorageMock.clear()
    resetRateLimit()
  })

  afterEach(() => {
    localStorageMock.clear()
    resetRateLimit()
  })

  describe('checkRateLimit', () => {
    it('allows first call for any feature', () => {
      expect(checkRateLimit('weekly_report').allowed).toBe(true)
      expect(checkRateLimit('post_workout').allowed).toBe(true)
      expect(checkRateLimit('workout_analysis').allowed).toBe(true)
      expect(checkRateLimit('plan_generation').allowed).toBe(true)
    })

    it('blocks second call within cooldown', () => {
      recordCall('weekly_report')
      const result = checkRateLimit('weekly_report')
      expect(result.allowed).toBe(false)
      if (!result.allowed && result.reason === 'cooldown') {
        expect(result.feature).toBe('weekly_report')
        expect(result.retryAfterMs).toBeGreaterThan(0)
      }
    })

    it('allows different features independently', () => {
      recordCall('weekly_report')
      expect(checkRateLimit('plan_generation').allowed).toBe(true)
    })

    it('blocks same feature when inflight, allows different feature', () => {
      acquireInflight('plan_generation')
      // Same feature blocked
      const blocked = checkRateLimit('plan_generation')
      expect(blocked.allowed).toBe(false)
      if (!blocked.allowed) {
        expect(blocked.reason).toBe('inflight')
      }
      // Different feature allowed (per-feature mutex, not global)
      const allowed = checkRateLimit('weekly_report')
      expect(allowed.allowed).toBe(true)
      releaseInflight('plan_generation')
    })

    it('blocks when daily quota exceeded', () => {
      // Record 50 calls to exhaust quota (cycle through features to avoid cooldown)
      const features: AiFeature[] = ['weekly_report', 'post_workout', 'workout_analysis', 'plan_generation']
      for (let i = 0; i < 50; i++) {
        recordCall(features[i % 4])
      }
      const result = checkRateLimit('weekly_report')
      expect(result.allowed).toBe(false)
      if (!result.allowed && result.reason === 'quota') {
        expect(result.quota).toBe(50)
      }
    })
  })

  describe('acquireInflight / releaseInflight (per-feature)', () => {
    it('prevents double-acquire of same feature', () => {
      acquireInflight('workout_analysis')
      const result = checkRateLimit('workout_analysis')
      expect(result.allowed).toBe(false)
      releaseInflight('workout_analysis')
      expect(checkRateLimit('workout_analysis').allowed).toBe(true)
    })

    it('allows concurrent different features', () => {
      acquireInflight('plan_generation')
      // Can still acquire a different feature
      acquireInflight('weekly_report')
      // Both are inflight
      expect(checkRateLimit('plan_generation').allowed).toBe(false)
      expect(checkRateLimit('weekly_report').allowed).toBe(false)
      // But a third different feature is allowed
      expect(checkRateLimit('workout_analysis').allowed).toBe(true)
      releaseInflight('plan_generation')
      releaseInflight('weekly_report')
    })
  })

  describe('recordCall', () => {
    it('increments daily count', () => {
      expect(getRemainingQuota()).toBe(50)
      recordCall('weekly_report')
      expect(getRemainingQuota()).toBe(49)
    })

    it('sets lastCall timestamp for cooldown', () => {
      recordCall('plan_generation')
      expect(getCooldownRemaining('plan_generation')).toBeGreaterThan(0)
    })

    it('does not affect other features cooldown', () => {
      recordCall('plan_generation')
      expect(getCooldownRemaining('weekly_report')).toBe(0)
    })
  })

  describe('getCooldownRemaining', () => {
    it('returns 0 when no call recorded', () => {
      expect(getCooldownRemaining('weekly_report')).toBe(0)
    })

    it('returns positive value after call', () => {
      recordCall('post_workout')
      expect(getCooldownRemaining('post_workout')).toBeGreaterThan(0)
    })
  })

  describe('formatCooldownRemaining', () => {
    it('returns empty string for 0 or negative', () => {
      expect(formatCooldownRemaining(0)).toBe('')
      expect(formatCooldownRemaining(-100)).toBe('')
    })

    it('formats minutes only', () => {
      expect(formatCooldownRemaining(5 * 60 * 1000)).toBe('5 min')
    })

    it('formats hours only', () => {
      expect(formatCooldownRemaining(2 * 60 * 60 * 1000)).toBe('2 h')
    })

    it('formats hours and minutes', () => {
      expect(formatCooldownRemaining(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2 h 15 min')
    })

    it('rounds up partial minutes', () => {
      expect(formatCooldownRemaining(30 * 1000)).toBe('1 min') // 30s → 1 min
    })
  })

  describe('daily reset', () => {
    it('resets count when date changes', () => {
      recordCall('weekly_report')
      expect(getRemainingQuota()).toBe(49)
      // Simulate next day by corrupting the date in storage
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const y = yesterday.getFullYear()
      const m = String(yesterday.getMonth() + 1).padStart(2, '0')
      const d = String(yesterday.getDate()).padStart(2, '0')
      localStorageMock.setItem('sr-ai-usage', JSON.stringify({
        date: `${y}-${m}-${d}`,
        count: 50,
        lastCall: { weekly_report: new Date().toISOString() },
      }))
      expect(getRemainingQuota()).toBe(50)
    })
  })

  describe('comfortable limits', () => {
    it('post_workout cooldown is 2 min (race protection only)', () => {
      recordCall('post_workout')
      const remaining = getCooldownRemaining('post_workout')
      // Should be ~2 min, not more than 3 min
      expect(remaining).toBeGreaterThan(60 * 1000) // > 1 min
      expect(remaining).toBeLessThanOrEqual(2 * 60 * 1000) // <= 2 min
    })

    it('plan_generation cooldown is 3 min (experimentation friendly)', () => {
      recordCall('plan_generation')
      const remaining = getCooldownRemaining('plan_generation')
      expect(remaining).toBeGreaterThan(2 * 60 * 1000) // > 2 min
      expect(remaining).toBeLessThanOrEqual(3 * 60 * 1000) // <= 3 min
    })

    it('weekly_report cooldown is 30 min', () => {
      recordCall('weekly_report')
      const remaining = getCooldownRemaining('weekly_report')
      expect(remaining).toBeGreaterThan(25 * 60 * 1000) // > 25 min
      expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000) // <= 30 min
    })

    it('workout_analysis cooldown is 30 min', () => {
      recordCall('workout_analysis')
      const remaining = getCooldownRemaining('workout_analysis')
      expect(remaining).toBeGreaterThan(25 * 60 * 1000) // > 25 min
      expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000) // <= 30 min
    })
  })
})
