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

/** Plans shown on dashboard home section.
 *  Dashboard always shows all active plans (capped at HOME_CUSTOM_LIMIT),
 *  regardless of the "show/hide from training" toggle in Plans — that toggle
 *  only affects the Plans page list, not the home dashboard. */
export function resolveHomeCustomPlans(
  allActive: CustomPlan[],
  _settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): CustomPlan[] {
  return allActive.slice(0, HOME_CUSTOM_LIMIT)
}

/** Active plans eligible for home but not shown in the section (max 3 cards). */
export function countHiddenHomeCustomPlans(
  allActive: CustomPlan[],
  _settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): number {
  return Math.max(0, allActive.length - HOME_CUSTOM_LIMIT)
}

export function pruneEnabledCustomPlanIds(
  enabledIds: string[],
  removedPlanId: string,
): string[] {
  return enabledIds.filter((id) => id !== removedPlanId)
}
