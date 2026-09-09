import { describe, expect, it, vi, beforeEach } from 'vitest'

import { EXERCISE_STARTERS } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

vi.mock('@/lib/db', () => {
  const starterExercises = EXERCISE_STARTERS.map((s, i) => ({
    id: `ex-${s.key}`,
    name:
      pl[`exerciseStarter${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}` as keyof typeof pl] as string,
    primaryMetric: s.primaryMetric,
    archived: false,
    source: 'starter',
    durationDisplayUnit: 'sec',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: i,
  }))
  const exercises = {
    put: vi.fn(),
    toArray: vi.fn(async () => starterExercises),
    get: vi.fn(async () => undefined),
  }
  const customPlans = {
    put: vi.fn(),
    toArray: vi.fn(async () => []),
    get: vi.fn(async () => undefined),
  }
  return {
    db: {
      exercises,
      customPlans,
      transaction: vi.fn(
        async (_mode: string, _t1: unknown, fn: () => Promise<void>) => fn(),
      ),
    },
  }
})

vi.mock('@/lib/sync', () => ({
  enqueueSync: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'gen-id'),
}))

vi.mock('@/stores/app-store', () => {
  const setSettings = vi.fn()
  return {
    useAppStore: {
      getState: () => ({
        settings: {
          customPlansFilterExplicit: false,
          enabledCustomPlanIds: [],
        },
        setSettings,
      }),
    },
  }
})

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvents: {
    starterTemplateShown: 'starter_template_shown',
    starterTemplatePreviewed: 'starter_template_previewed',
    starterTemplateActivated: 'starter_template_activated',
  },
}))

vi.mock('@/lib/custom-exercise-dedup', () => ({
  findActiveExerciseByDedupKey: vi.fn(async () => undefined),
}))

vi.mock('@/lib/custom-plan-service', () => ({
  ensureDefaultExercises: vi.fn(async () => ({ seeded: false, created: [] })),
  listCustomPlans: vi.fn(async () => []),
  saveCustomPlan: vi.fn(async (plan: { id: string; name: string; source?: string }) => {
    const next = { ...plan, status: 'active', updatedAt: new Date().toISOString() }
    const { enqueueSync } = await import('@/lib/sync')
    enqueueSync('custom_plans', 'insert', next)
    return next
  }),
}))

import { enqueueSync } from '@/lib/sync'
import { generateId } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { ensureDefaultExercises, saveCustomPlan } from '@/lib/custom-plan-service'
import {
  STARTER_TEMPLATES,
  getStarterTemplate,
  starterTemplateEstimatedWeeks,
  materializeStarterTemplate,
  isStarterPlan,
} from '@/lib/starter-templates'
import type { CustomPlan } from '@/lib/exercise-model'

describe('starter templates data', () => {
  it('has 9 templates', () => {
    expect(STARTER_TEMPLATES).toHaveLength(9)
  })

  it('all templates have unique ids', () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all templates have at least one day with exercises', () => {
    for (const t of STARTER_TEMPLATES) {
      expect(t.days.length).toBeGreaterThan(0)
      for (const day of t.days) {
        expect(day.exercises.length).toBeGreaterThan(0)
      }
    }
  })

  it('all template exercises reference valid starter keys', () => {
    const validKeys = new Set([
      'pushups', 'pullups', 'squats', 'plank', 'sidePlank', 'press',
      'benchPress', 'inclineBenchPress', 'dumbbellFlyes', 'dips', 'pushupWide',
      'declineBenchPress', 'pecDeck', 'barbellRow', 'latPulldown', 'deadlift',
      'seatedRow', 'facePulls', 'dumbbellRow', 'tbarRow', 'straightArmPulldown',
      'shrug', 'overheadPress', 'lateralRaise', 'frontRaise', 'rearDeltFlyes',
      'arnoldPress', 'uprightRow', 'barbellCurl', 'dumbbellCurl', 'hammerCurl',
      'tricepPushdown', 'skullCrusher', 'closeGripBench', 'concentrationCurl',
      'preacherCurl', 'overheadTricepExtension', 'tricepKickback', 'legPress',
      'lunges', 'romanianDeadlift', 'legExtension', 'legCurl', 'calfRaise',
      'gobletSquat', 'hipThrust', 'frontSquat', 'stepUp', 'crunches',
      'hangingLegRaise', 'russianTwist', 'mountainClimbers', 'deadBug',
      'reverseCrunch', 'lyingLegRaise', 'burpees', 'kettlebellSwing',
      'thrusters', 'cleanAndPress', 'stairClimbing', 'running', 'cycling',
      'rowingMachine', 'elliptical', 'jumpRope', 'jumpingJacks', 'highKnees',
    ])
    for (const t of STARTER_TEMPLATES) {
      for (const day of t.days) {
        for (const ex of day.exercises) {
          expect(validKeys.has(ex.starterKey)).toBe(true)
        }
      }
    }
  })

  it('all templates have progression enabled', () => {
    for (const t of STARTER_TEMPLATES) {
      expect(t.progression?.enabled).toBe(true)
    }
  })

  it('getStarterTemplate returns template by id', () => {
    const t = getStarterTemplate('foundation-bodyweight-3d')
    expect(t).toBeDefined()
    expect(t?.category).toBe('home')
  })

  it('getStarterTemplate returns undefined for unknown id', () => {
    expect(getStarterTemplate('nonexistent')).toBeUndefined()
  })

  it('starterTemplateEstimatedWeeks returns reasonable range', () => {
    const t = STARTER_TEMPLATES[0]!
    const [min, max] = starterTemplateEstimatedWeeks(t)
    expect(min).toBeGreaterThan(0)
    expect(max).toBeGreaterThan(min)
  })
})

describe('materializeStarterTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    vi.mocked(generateId).mockImplementation(() => `id-${++n}`)
  })

  it('seeds starter exercises first', async () => {
    const template = STARTER_TEMPLATES[0]!
    await materializeStarterTemplate(template)
    expect(ensureDefaultExercises).toHaveBeenCalled()
  })

  it('creates plan with source: starter', async () => {
    const template = STARTER_TEMPLATES[0]!
    const plan = await materializeStarterTemplate(template)
    expect(plan.source).toBe('starter')
  })

  it('creates plan with communityPublicationId: null', async () => {
    const template = STARTER_TEMPLATES[0]!
    const plan = await materializeStarterTemplate(template)
    expect(plan.communityPublicationId).toBeNull()
  })

  it('activates the plan', async () => {
    const template = STARTER_TEMPLATES[0]!
    await materializeStarterTemplate(template)
    expect(saveCustomPlan).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'starter' }),
      { activate: true },
    )
  })

  it('enqueues sync for custom_plans (via saveCustomPlan)', async () => {
    const template = STARTER_TEMPLATES[0]!
    await materializeStarterTemplate(template)
    expect(enqueueSync).toHaveBeenCalledWith(
      'custom_plans',
      'insert',
      expect.objectContaining({ source: 'starter' }),
    )
  })

  it('tracks activation event', async () => {
    const template = STARTER_TEMPLATES[0]!
    await materializeStarterTemplate(template)
    expect(track).toHaveBeenCalledWith(
      AnalyticsEvents.starterTemplateActivated,
      expect.objectContaining({ templateId: template.id }),
    )
  })

  it('sets customPlansFilterExplicit: true and adds plan to enabledCustomPlanIds', async () => {
    const template = STARTER_TEMPLATES[0]!
    await materializeStarterTemplate(template)
    const state = useAppStore.getState()
    expect(state.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        customPlansFilterExplicit: true,
        enabledCustomPlanIds: expect.arrayContaining(['id-1']),
      }),
    )
  })
})

describe('isStarterPlan', () => {
  it('returns true for source: starter', () => {
    const plan = { source: 'starter' } as CustomPlan
    expect(isStarterPlan(plan)).toBe(true)
  })

  it('returns false for source: user', () => {
    const plan = { source: 'user' } as CustomPlan
    expect(isStarterPlan(plan)).toBe(false)
  })

  it('returns false for source: community', () => {
    const plan = { source: 'community' } as CustomPlan
    expect(isStarterPlan(plan)).toBe(false)
  })
})
