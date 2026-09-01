import { describe, expect, it } from 'vitest'
import {
  buildCustomPlanHomeCardModel,
  getCustomPlanDayPreview,
  getCustomPlanDisplayDay,
} from '@/lib/custom-plan-home-summary'
import type { CustomPlan, CustomProgramProgress, ExerciseDefinition } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

const exercises: ExerciseDefinition[] = [
  {
    id: 'ex1',
    name: 'Pompki',
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ex2',
    name: 'Przysiady',
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const plan: CustomPlan = {
  id: 'plan1',
  name: 'Full body',
  description: '',
  status: 'active',
  source: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  days: [
    {
      dayNumber: 1,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'ex1',
          order: 0,
          restBetweenSetsSec: 90,
          sets: [{ reps: { kind: 'fixed', value: 10 } }, { reps: { kind: 'fixed', value: 10 } }],
        },
      ],
    },
    {
      dayNumber: 2,
      restAfterDay: 1,
      exercises: [
        {
          exerciseId: 'ex2',
          order: 0,
          restBetweenSetsSec: 90,
          sets: [{ reps: { kind: 'fixed', value: 12 } }],
        },
      ],
    },
  ],
}

describe('custom-plan-home-summary', () => {
  it('getCustomPlanDisplayDay uses current day from progress', () => {
    const progress: CustomProgramProgress = {
      customPlanId: plan.id,
      currentDay: 2,
      status: 'active',
      cycleAttempt: 1,
      lastWorkoutAt: null,
      nextWorkoutAfter: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(getCustomPlanDisplayDay(plan, progress)).toBe(2)
  })

  it('getCustomPlanDayPreview lists exercise names and counts', () => {
    const preview = getCustomPlanDayPreview(plan, 1, exercises)
    expect(preview.names).toBe('Pompki')
    expect(preview.exerciseCount).toBe(1)
    expect(preview.setCount).toBe(2)
  })

  it('buildCustomPlanHomeCardModel shows resume badge and hint', () => {
    const model = buildCustomPlanHomeCardModel({
      plan,
      progress: {
        customPlanId: plan.id,
        currentDay: 1,
        status: 'active',
        cycleAttempt: 1,
        lastWorkoutAt: null,
        nextWorkoutAfter: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      resume: { day: 1, set: 2, totalSets: 2, stale: false },
      exercises,
    })
    expect(model.badge.label).toBe(pl.statusInProgress)
    expect(model.detailLine).toContain('seria 2/2')
    expect(model.ctaLabel).toContain('Kontynuuj')
    expect(model.ctaAction).toBe('train')
  })

  it('buildCustomPlanHomeCardModel offers unpause when plan paused', () => {
    const model = buildCustomPlanHomeCardModel({
      plan,
      progress: {
        customPlanId: plan.id,
        currentDay: 1,
        status: 'paused',
        cycleAttempt: 1,
        lastWorkoutAt: null,
        nextWorkoutAfter: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      resume: null,
      exercises,
    })
    expect(model.badge.label).toBe(pl.statusPaused)
    expect(model.ctaAction).toBe('unpause')
    expect(model.ctaLabel).toBe(pl.planResume)
  })

  it('buildCustomPlanHomeCardModel shows rest detail when on break', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2)
    tomorrow.setHours(12, 0, 0, 0)
    const model = buildCustomPlanHomeCardModel({
      plan,
      progress: {
        customPlanId: plan.id,
        currentDay: 2,
        status: 'rest',
        cycleAttempt: 1,
        lastWorkoutAt: '2026-01-01T00:00:00.000Z',
        nextWorkoutAfter: tomorrow.toISOString(),
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      resume: null,
      exercises,
    })
    expect(model.badge.label).toBe(pl.statusRest)
    expect(model.detailLine).toContain('Następny trening')
  })
})
