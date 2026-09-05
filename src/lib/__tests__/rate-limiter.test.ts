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
      const result = checkRateLimit('weekly_report')
      expect(result.allowed).toBe(true)
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
      const result = checkRateLimit('plan_generation')
      expect(result.allowed).toBe(true)
    })

    it('blocks when inflight', () => {
      acquireInflight()
      const result = checkRateLimit('weekly_report')
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.reason).toBe('inflight')
      }
      releaseInflight()
    })

    it('blocks when daily quota exceeded', () => {
      // Record 50 calls to exhaust quota
      for (let i = 0; i < 50; i++) {
        // Use different features to avoid cooldown
        const features: AiFeature[] = ['weekly_report', 'post_workout', 'workout_analysis', 'plan_generation']
        recordCall(features[i % 4])
      }
      const result = checkRateLimit('weekly_report')
      expect(result.allowed).toBe(false)
      if (!result.allowed && result.reason === 'quota') {
        expect(result.quota).toBe(50)
      }
    })
  })

  describe('acquireInflight / releaseInflight', () => {
    it('blocks concurrent calls while inflight', () => {
      acquireInflight()
      const result = checkRateLimit('plan_generation')
      expect(result.allowed).toBe(false)
      releaseInflight()
      const result2 = checkRateLimit('plan_generation')
      expect(result2.allowed).toBe(true)
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
    it('returns empty string for 0', () => {
      expect(formatCooldownRemaining(0)).toBe('')
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
})
