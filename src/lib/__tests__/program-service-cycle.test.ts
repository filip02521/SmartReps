import { describe, it, expect } from 'vitest'
import { getNextHigherCycle } from '@/lib/program-service'

describe('getNextHigherCycle', () => {
  it('returns next higher cycle (level + 1) for pushups 11-20', () => {
    const next = getNextHigherCycle('pushups', 'pushups-11-20')
    expect(next).not.toBeNull()
    expect(next!.id).toBe('pushups-21-25')
    expect(next!.level).toBe(4)
  })

  it('returns next higher cycle for pushups 6-10', () => {
    const next = getNextHigherCycle('pushups', 'pushups-6-10')
    expect(next).not.toBeNull()
    expect(next!.id).toBe('pushups-11-20')
    expect(next!.level).toBe(3)
  })

  it('returns null for the highest pushups cycle (powyzej-60)', () => {
    const next = getNextHigherCycle('pushups', 'pushups-powyzej-60')
    expect(next).toBeNull()
  })

  it('returns null for unknown cycle id', () => {
    const next = getNextHigherCycle('pushups', 'nonexistent-cycle')
    expect(next).toBeNull()
  })

  it('returns next higher cycle for pullups', () => {
    const next = getNextHigherCycle('pullups', 'pullups-ponizej-4')
    expect(next).not.toBeNull()
    expect(next!.level).toBe(2)
  })

  it('returns next higher cycle for squats', () => {
    const next = getNextHigherCycle('squats', 'squats-1-20')
    expect(next).not.toBeNull()
    expect(next!.level).toBe(2)
  })
})
