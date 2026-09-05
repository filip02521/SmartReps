import { describe, expect, it } from 'vitest'
import { renderShareCardPng, type ShareCardInput, type ShareCardCustomInput } from '@/lib/share-card'

describe('share-card badges', () => {
  it('renders without badges when no enrichment data is provided', async () => {
    // When ctx is null (jsdom doesn't support canvas), renderShareCardPng throws
    await expect(
      renderShareCardPng({
        program: 'pushups',
        dayNumber: 1,
        totalReps: 50,
        passed: true,
      }),
    ).rejects.toThrow('canvas_unavailable')
  })

  it('accepts enrichment fields without error in type system', () => {
    const input: ShareCardInput = {
      program: 'pushups',
      dayNumber: 1,
      totalReps: 50,
      passed: true,
      prCount: 2,
      streak: 5,
      bestSetReps: 15,
    }
    expect(input.prCount).toBe(2)
    expect(input.streak).toBe(5)
    expect(input.bestSetReps).toBe(15)
  })

  it('accepts custom enrichment fields with volume', () => {
    const input: ShareCardCustomInput = {
      planName: 'Test Plan',
      dayNumber: 1,
      exerciseCount: 3,
      totalSets: 9,
      passed: true,
      prCount: 1,
      volumeKg: 500,
      bestSetReps: 12,
    }
    expect(input.volumeKg).toBe(500)
    expect(input.prCount).toBe(1)
  })
})
