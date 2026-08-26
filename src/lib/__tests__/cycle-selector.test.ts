import { describe, it, expect } from 'vitest'
import { getRetestOptions, isHigherCycle, isLowerCycle } from '@/lib/cycle-selector'
import { getCycleById } from '@/data/plans'

describe('getRetestOptions', () => {
  it('recommends lower cycle when test score dropped below current', () => {
    const opts = getRetestOptions('pushups', 8, 'pushups-21-25')
    expect(opts.recommended.id).toBe('pushups-21-25')
  })

  it('recommends matched cycle on improvement', () => {
    const opts = getRetestOptions('pullups', 12, 'pullups-4-5')
    expect(opts.recommended.id).toBe('pullups-12-15')
  })

  it('includes alternatives from same program', () => {
    const opts = getRetestOptions('pushups', 20, 'pushups-6-10')
    expect(opts.alternatives.every((c) => c.program === 'pushups')).toBe(true)
    expect(opts.alternatives.some((c) => c.id === opts.recommended.id)).toBe(false)
  })
})

describe('cycle ordering helpers', () => {
  it('detects higher and lower cycles', () => {
    const low = getCycleById('pushups-6-10')!
    const high = getCycleById('pushups-21-25')!
    expect(isHigherCycle(high, low)).toBe(true)
    expect(isLowerCycle(low, high)).toBe(true)
  })
})
