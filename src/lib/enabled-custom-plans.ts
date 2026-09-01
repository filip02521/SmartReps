import type { CustomPlan } from '@/lib/exercise-model'
import type { UserSettings } from '@/stores/app-store'

export const HOME_CUSTOM_LIMIT = 3

export function isCustomPlanEnabledInProfile(
  planId: string,
  _allActivePlanIds: string[],
  settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): boolean {
  if (!settings.customPlansFilterExplicit) return true
  return settings.enabledCustomPlanIds.includes(planId)
}

/** Plans shown on dashboard home section. */
export function resolveHomeCustomPlans(
  allActive: CustomPlan[],
  settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): CustomPlan[] {
  if (!settings.customPlansFilterExplicit) {
    return allActive.slice(0, HOME_CUSTOM_LIMIT)
  }
  if (settings.enabledCustomPlanIds.length === 0) return []
  return allActive
    .filter((p) => settings.enabledCustomPlanIds.includes(p.id))
    .slice(0, HOME_CUSTOM_LIMIT)
}

/** Active plans eligible for home but not shown in the section (max 3 cards). */
export function countHiddenHomeCustomPlans(
  allActive: CustomPlan[],
  settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): number {
  const shown = resolveHomeCustomPlans(allActive, settings)
  if (!settings.customPlansFilterExplicit) {
    return Math.max(0, allActive.length - shown.length)
  }
  const eligible = allActive.filter((p) => settings.enabledCustomPlanIds.includes(p.id))
  return Math.max(0, eligible.length - shown.length)
}

export function pruneEnabledCustomPlanIds(
  enabledIds: string[],
  removedPlanId: string,
): string[] {
  return enabledIds.filter((id) => id !== removedPlanId)
}
