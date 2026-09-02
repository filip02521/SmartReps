import { describe, expect, it } from 'vitest'
import {
  formatSessionElapsed,
  sessionCompletedWallClockSec,
  sessionWallClockSec,
} from '@/lib/session-elapsed'

describe('session-elapsed', () => {
  it('formats under and over one hour', () => {
    expect(formatSessionElapsed(5)).toBe('0:05')
    expect(formatSessionElapsed(90)).toBe('1:30')
    expect(formatSessionElapsed(3600)).toBe('1:00:00')
    expect(formatSessionElapsed(3661)).toBe('1:01:01')
    expect(formatSessionElapsed(-3)).toBe('0:00')
  })

  it('computes wall-clock seconds for live and finished sessions', () => {
    expect(
      sessionWallClockSec(
        '2026-02-01T10:00:00.000Z',
        '2026-02-01T10:12:30.000Z',
      ),
    ).toBe(750)
    expect(
      sessionWallClockSec(
        '2026-02-01T10:00:00.000Z',
        null,
        new Date('2026-02-01T10:00:45.000Z').getTime(),
      ),
    ).toBe(45)
  })

  it('summary helper requires completedAt (no live now fallback)', () => {
    expect(
      sessionCompletedWallClockSec('2026-02-01T10:00:00.000Z', null),
    ).toBe(0)
    expect(
      sessionCompletedWallClockSec('2026-02-01T10:00:00.000Z', undefined),
    ).toBe(0)
    expect(
      sessionCompletedWallClockSec(
        '2026-02-01T10:00:00.000Z',
        '2026-02-01T10:05:00.000Z',
      ),
    ).toBe(300)
  })
})
