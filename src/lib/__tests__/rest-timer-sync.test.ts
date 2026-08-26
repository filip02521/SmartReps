import { describe, it, expect } from 'vitest'
import { reconcileRestTimerJson, legacyRestTimerFromStartedAt } from '@/lib/rest-timer-sync'

describe('rest-timer-sync', () => {
  it('reconciles active timer from JSON', () => {
    const startedAt = Date.now() - 5000
    const json = JSON.stringify({
      mode: 'pill',
      totalSec: 60,
      remainingSec: 55,
      startedAt,
    })
    const result = reconcileRestTimerJson(json)
    expect(result).not.toBeNull()
    const parsed = JSON.parse(result!)
    expect(parsed.remainingSec).toBeGreaterThan(0)
    expect(parsed.remainingSec).toBeLessThanOrEqual(60)
  })

  it('returns null for expired legacy timer', () => {
    const old = new Date(Date.now() - 200_000).toISOString()
    expect(legacyRestTimerFromStartedAt(old)).toBeNull()
  })
})
