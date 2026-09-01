import { describe, expect, it } from 'vitest'
import {
  shouldPreferLocalCustomProgress,
  mapRemoteCustomProgressToLocal,
} from '@/lib/custom-progress-sync-merge'
import type { CustomProgramProgress } from '@/lib/exercise-model'

const localBase: CustomProgramProgress = {
  customPlanId: 'plan-1',
  currentDay: 5,
  status: 'active',
  cycleAttempt: 1,
  lastWorkoutAt: null,
  nextWorkoutAfter: null,
  updatedAt: '2026-06-01T12:00:00.000Z',
}

describe('shouldPreferLocalCustomProgress', () => {
  it('prefers higher currentDay within same cycle attempt even if remote is newer', () => {
    expect(
      shouldPreferLocalCustomProgress(localBase, {
        custom_plan_id: 'plan-1',
        current_day: 3,
        status: 'active',
        cycle_attempt: 1,
        last_workout_at: null,
        next_workout_after: null,
        updated_at: '2026-06-02T12:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('prefers remote when remote day is ahead on same attempt', () => {
    expect(
      shouldPreferLocalCustomProgress(
        { ...localBase, currentDay: 2 },
        {
          custom_plan_id: 'plan-1',
          current_day: 4,
          status: 'active',
          cycle_attempt: 1,
          last_workout_at: null,
          next_workout_after: null,
          updated_at: '2026-06-01T12:00:00.000Z',
        },
      ),
    ).toBe(false)
  })
})

describe('mapRemoteCustomProgressToLocal', () => {
  it('maps remote row', () => {
    expect(
      mapRemoteCustomProgressToLocal({
        custom_plan_id: 'p',
        current_day: 2,
        status: 'rest',
        cycle_attempt: 3,
        last_workout_at: '2026-01-01',
        next_workout_after: '2026-01-03',
        updated_at: '2026-01-02',
      }),
    ).toEqual({
      id: undefined,
      customPlanId: 'p',
      currentDay: 2,
      status: 'rest',
      cycleAttempt: 3,
      lastWorkoutAt: '2026-01-01',
      nextWorkoutAfter: '2026-01-03',
      updatedAt: '2026-01-02',
    })
  })
})
