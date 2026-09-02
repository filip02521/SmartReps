import { describe, expect, it } from 'vitest'
import type { CustomPlan, ExerciseDefinition } from '@/lib/exercise-model'
import {
  buildCommunitySnapshot,
  parseCommunitySnapshot,
  remapPlanDays,
} from '@/lib/community-snapshot'
import { communitySlugFromTitle, slugify } from '@/lib/slugify'
import { normalizeCommunityTags } from '@/data/community-tags'

function sampleExercise(id: string, name = 'Pompki'): ExerciseDefinition {
  return {
    id,
    name,
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function samplePlan(exerciseId: string): CustomPlan {
  return {
    id: 'plan-1',
    name: 'Siła w domu',
    description: 'Opis',
    status: 'active',
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    progression: null,
    deload: { enabled: true, everyNCycles: 4, repsDelta: -2 },
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          {
            exerciseId,
            order: 0,
            sets: [{ reps: { kind: 'fixed', value: 10 } }],
            restBetweenSetsSec: 90,
          },
        ],
      },
    ],
  }
}

describe('community snapshot', () => {
  it('embeds exercises and preserves deload', () => {
    const ex = sampleExercise('ex-1')
    const plan = samplePlan(ex.id)
    const built = buildCommunitySnapshot(plan, new Map([[ex.id, ex]]))
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.snapshot.exercises).toHaveLength(1)
    expect(built.snapshot.deload?.enabled).toBe(true)
    expect(built.snapshot.progression).toBeNull()
  })

  it('rejects archived exercise refs', () => {
    const ex = { ...sampleExercise('ex-1'), archived: true }
    const plan = samplePlan(ex.id)
    const built = buildCommunitySnapshot(plan, new Map([[ex.id, ex]]))
    expect(built.ok).toBe(false)
  })

  it('round-trips parse and remaps exercise ids', () => {
    const ex = sampleExercise('ex-old')
    const plan = samplePlan(ex.id)
    const built = buildCommunitySnapshot(plan, new Map([[ex.id, ex]]))
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const parsed = parseCommunitySnapshot(built.snapshot)
    expect(parsed?.schemaVersion).toBe(1)
    const remapped = remapPlanDays(parsed!.days, new Map([['ex-old', 'ex-new']]))
    expect(remapped[0]?.exercises[0]?.exerciseId).toBe('ex-new')
  })

  it('keeps group ids when remapping', () => {
    const exA = sampleExercise('a', 'A')
    const exB = sampleExercise('b', 'B')
    const plan: CustomPlan = {
      ...samplePlan('a'),
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          groups: [{ id: 'g1', kind: 'superset' }],
          exercises: [
            {
              exerciseId: 'a',
              order: 0,
              groupId: 'g1',
              sets: [{ reps: { kind: 'fixed', value: 5 } }],
              restBetweenSetsSec: 60,
            },
            {
              exerciseId: 'b',
              order: 1,
              groupId: 'g1',
              sets: [{ reps: { kind: 'fixed', value: 5 } }],
              restBetweenSetsSec: 60,
            },
          ],
        },
      ],
    }
    const built = buildCommunitySnapshot(
      plan,
      new Map([
        [exA.id, exA],
        [exB.id, exB],
      ]),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const remapped = remapPlanDays(
      built.snapshot.days,
      new Map([
        ['a', 'na'],
        ['b', 'nb'],
      ]),
    )
    expect(remapped[0]?.exercises.every((e) => e.groupId === 'g1')).toBe(true)
    expect(remapped[0]?.groups?.[0]?.id).toBe('g1')
  })

  it('drops exercises without remap target', () => {
    const remapped = remapPlanDays(
      [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [
            {
              exerciseId: 'keep',
              order: 0,
              sets: [{ reps: { kind: 'fixed', value: 5 } }],
              restBetweenSetsSec: 60,
            },
            {
              exerciseId: 'gone',
              order: 1,
              sets: [{ reps: { kind: 'fixed', value: 5 } }],
              restBetweenSetsSec: 60,
            },
          ],
        },
      ],
      new Map([['keep', 'new-keep']]),
    )
    expect(remapped[0]?.exercises).toHaveLength(1)
    expect(remapped[0]?.exercises[0]?.exerciseId).toBe('new-keep')
  })
})

describe('slugify', () => {
  it('maps polish diacritics', () => {
    expect(slugify('Ćwiczenia siłowe')).toBe('cwiczenia-silowe')
  })

  it('builds community slug with suffix', () => {
    expect(communitySlugFromTitle('Test', 'abcdef12-3456')).toMatch(/^test-abcdef$/)
  })
})

describe('community tags', () => {
  it('normalizes and caps at 3', () => {
    expect(normalizeCommunityTags(['home', 'home', 'gym', 'weights', 'bodyweight'])).toEqual([
      'home',
      'gym',
      'weights',
    ])
  })
})
