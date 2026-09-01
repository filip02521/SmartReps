import { describe, expect, it } from 'vitest'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import type { LocalWorkoutSession } from '@/lib/db'

function session(partial: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'c1',
    day: 1,
    attempt: 1,
    status: 'completed',
    startedAt: '2026-01-01',
    ...partial,
  } as LocalWorkoutSession
}

describe('isCustomWorkoutSession', () => {
  it('detects programKind custom', () => {
    expect(isCustomWorkoutSession(session({ programKind: 'custom', program: 'custom' }))).toBe(true)
  })

  it('falls back to program custom for legacy rows', () => {
    expect(isCustomWorkoutSession(session({ program: 'custom' }))).toBe(true)
  })

  it('rejects builtin sessions', () => {
    expect(isCustomWorkoutSession(session({ program: 'pushups', programKind: 'builtin' }))).toBe(
      false,
    )
  })
})
