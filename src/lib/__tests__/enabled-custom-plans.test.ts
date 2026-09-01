import { describe, expect, it } from 'vitest'
import {
  isCustomPlanEnabledInProfile,
  pruneEnabledCustomPlanIds,
  resolveHomeCustomPlans,
  countHiddenHomeCustomPlans,
} from '@/lib/enabled-custom-plans'
import type { CustomPlan } from '@/lib/exercise-model'

function plan(id: string): CustomPlan {
  return {
    id,
    name: id,
    description: '',
    status: 'active',
    days: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    source: 'user',
    progression: null,
  }
}

describe('enabled-custom-plans', () => {
  it('shows all active plans on home when filter not explicit', () => {
    const all = [plan('a'), plan('b'), plan('c'), plan('d')]
    const result = resolveHomeCustomPlans(all, {
      enabledCustomPlanIds: ['b'],
      customPlansFilterExplicit: false,
    })
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('respects explicit enabled list on home', () => {
    const all = [plan('a'), plan('b'), plan('c')]
    const result = resolveHomeCustomPlans(all, {
      enabledCustomPlanIds: ['c', 'a'],
      customPlansFilterExplicit: true,
    })
    expect(result.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('returns empty home list when explicit filter has no ids', () => {
    expect(
      resolveHomeCustomPlans([plan('a')], {
        enabledCustomPlanIds: [],
        customPlansFilterExplicit: true,
      }),
    ).toEqual([])
  })

  it('profile toggle defaults to all active when not explicit', () => {
    expect(
      isCustomPlanEnabledInProfile('x', ['a', 'b'], {
        enabledCustomPlanIds: [],
        customPlansFilterExplicit: false,
      }),
    ).toBe(true)
  })

  it('prunes removed plan from enabled ids', () => {
    expect(pruneEnabledCustomPlanIds(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('counts hidden plans with explicit filter', () => {
    const all = [plan('a'), plan('b'), plan('c'), plan('d')]
    expect(
      countHiddenHomeCustomPlans(all, {
        enabledCustomPlanIds: ['a', 'b', 'c', 'd'],
        customPlansFilterExplicit: true,
      }),
    ).toBe(1)
  })
})
