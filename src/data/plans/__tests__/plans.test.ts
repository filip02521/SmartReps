import { describe, it, expect } from 'vitest'
import { allCycles } from '@/data/plans'

describe('plan data snapshot', () => {
  it('has exactly 38 cycles', () => {
    expect(allCycles).toHaveLength(38)
  })

  it('has 12 pushups, 11 pullups and 15 squats cycles', () => {
    expect(allCycles.filter((c) => c.program === 'pushups')).toHaveLength(12)
    expect(allCycles.filter((c) => c.program === 'pullups')).toHaveLength(11)
    expect(allCycles.filter((c) => c.program === 'squats')).toHaveLength(15)
  })

  it('uses prefixed cycle ids', () => {
    for (const cycle of allCycles) {
      expect(cycle.id).toMatch(/^(pushups|pullups|squats)-/)
    }
  })
})
