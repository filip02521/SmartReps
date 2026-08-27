import { describe, expect, it } from 'vitest'
import { createRestTimer, tickRestTimer, skipRest } from '@/lib/rest-timer'
import { formatRestTime } from '@/lib/utils'

describe('createRestTimer', () => {
  it('starts in pill mode by default', () => {
    const t = createRestTimer(90)
    expect(t.mode).toBe('pill')
    expect(t.totalSec).toBe(90)
    expect(t.remainingSec).toBe(90)
    expect(t.startedAt).toBeTypeOf('number')
  })

  it('can start expanded for post-set rest UI', () => {
    const t = createRestTimer(60, 'expanded')
    expect(t.mode).toBe('expanded')
    expect(t.remainingSec).toBe(60)
  })

  it('clamps negative totals', () => {
    expect(createRestTimer(-5).totalSec).toBe(0)
  })
})

describe('formatRestTime', () => {
  it('formats mm:ss', () => {
    expect(formatRestTime(90)).toBe('1:30')
    expect(formatRestTime(5)).toBe('0:05')
    expect(formatRestTime(0)).toBe('0:00')
  })

  it('handles invalid values safely', () => {
    expect(formatRestTime(Number.NaN)).toBe('0:00')
    expect(formatRestTime(-3)).toBe('0:00')
  })
})

describe('tickRestTimer', () => {
  it('does not tick idle timers', () => {
    const idle = skipRest()
    expect(tickRestTimer(idle)).toEqual(idle)
  })
})
