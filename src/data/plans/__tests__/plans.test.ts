import { describe, it, expect } from 'vitest'
import { allCycles } from '@/data/plans'

describe('plan data snapshot', () => {
  it('has exactly 23 cycles', () => {
    expect(allCycles).toHaveLength(23)
  })

  it('has 12 pushups and 11 pullups cycles', () => {
    expect(allCycles.filter((c) => c.program === 'pushups')).toHaveLength(12)
    expect(allCycles.filter((c) => c.program === 'pullups')).toHaveLength(11)
  })

  it('uses prefixed cycle ids', () => {
    for (const cycle of allCycles) {
      expect(cycle.id).toMatch(/^(pushups|pullups)-/)
    }
  })
})
