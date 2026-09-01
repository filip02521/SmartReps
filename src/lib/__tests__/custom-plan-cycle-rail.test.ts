import { describe, expect, it } from 'vitest'
import {
  resolveCustomCycleDayStatus,
  sessionsForCycleAttempt,
} from '@/lib/custom-plan-cycle-rail'
import type { CustomProgramProgress } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'

const progress: CustomProgramProgress = {
  customPlanId: 'p1',
  currentDay: 2,
  status: 'active',
  cycleAttempt: 2,
  lastWorkoutAt: null,
  nextWorkoutAfter: null,
  updatedAt: '',
}

function sess(partial: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 'x',
    program: 'custom',
    customPlanId: 'p1',
    cycleId: 'custom:p1',
    cycleAttempt: 2,
    dayNumber: 1,
    status: 'completed',
    passed: true,
    startedAt: '',
    completedAt: '',
    setResults: [],
    exerciseLogs: [],
    ...partial,
  }
}

describe('custom-plan-cycle-rail', () => {
  it('scopes sessions to cycle attempt', () => {
    const all = [
      sess({ id: 'old', cycleAttempt: 1, dayNumber: 1, passed: true }),
      sess({ id: 'new', cycleAttempt: 2, dayNumber: 1, passed: false }),
    ]
    expect(sessionsForCycleAttempt(all, 2)).toHaveLength(1)
    expect(resolveCustomCycleDayStatus(1, progress, all)).toBe('failed')
  })

  it('marks current day at rest', () => {
    const resting: CustomProgramProgress = { ...progress, currentDay: 2, status: 'rest' }
    expect(resolveCustomCycleDayStatus(2, resting, [])).toBe('rest')
  })
})
