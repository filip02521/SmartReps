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
 *  Honors the "show/hide on training" toggle in Plans → Moje — hidden plans
 *  don't appear on the home dashboard (capped at HOME_CUSTOM_LIMIT). */
export function resolveHomeCustomPlans(
  allActive: CustomPlan[],
  settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): CustomPlan[] {
  return allActive
    .filter((p) => isCustomPlanEnabledInProfile(p.id, allActive.map((a) => a.id), settings))
    .slice(0, HOME_CUSTOM_LIMIT)
}

/** Active plans eligible for home but not shown in the section (max 3 cards). */
export function countHiddenHomeCustomPlans(
  allActive: CustomPlan[],
  settings: Pick<UserSettings, 'enabledCustomPlanIds' | 'customPlansFilterExplicit'>,
): number {
  const eligible = allActive.filter((p) =>
    isCustomPlanEnabledInProfile(p.id, allActive.map((a) => a.id), settings),
  )
  return Math.max(0, eligible.length - HOME_CUSTOM_LIMIT)
}

export function pruneEnabledCustomPlanIds(
  enabledIds: string[],
  removedPlanId: string,
): string[] {
  return enabledIds.filter((id) => id !== removedPlanId)
}
