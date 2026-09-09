/**
 * Feature gating for freemium model.
 *
 * Etap 0: constants and helpers only — no features are blocked yet.
 * Etap 1: call canUseFeature() before Pro-only features; show ProTeaser if blocked.
 *
 * Gating philosophy:
 * - Core training (23 cycles, 3 custom plans) = FREE (growth driver)
 * - Community (browse, import, publish max 3, follow) = FREE (network effect)
 * - BYOK AI = FREE (zero cost for SmartReps)
 * - Hosted AI, unlimited plans, advanced analytics, cloud sync, export, web push = PRO
 */

import { isPro } from '@/lib/subscription'

// ── Free tier limits ──

export const FREE_CUSTOM_PLAN_LIMIT = 3
export const FREE_PUBLICATION_LIMIT = 3

// ── Feature keys ──

export type ProFeature =
  | 'hostedAi'
  | 'unlimitedCustomPlans'
  | 'advancedAnalytics'
  | 'cloudSync'
  | 'webPush'
  | 'export'
  | 'unlimitedPublications'
  | 'verifiedBadge'
  | 'manualShowcase'

/**
 * Check if a feature requires Pro.
 * Pure function — safe for tests.
 */
export function requiresPro(feature: ProFeature): boolean {
  // All features in the ProFeature union are Pro-only by definition.
  // Free features (builtin cycles, basic progress, BYOK AI, community browse)
  // are NOT in this union — they don't need gating.
  void feature
  return true
}

/**
 * Can the current user use a Pro feature?
 * In Etap 0: always true (no gating enforced yet).
 * In Etap 1: `isPro() && !requiresPro(feature)` → false for free users.
 */
export function canUseFeature(feature: ProFeature): boolean {
  void feature
  // Etap 0: no gating — all features available to all users.
  // Etap 1: return isPro()
  return true
}

/**
 * Check if user has hit the free-tier custom plan limit.
 * Returns true if user can create another custom plan.
 */
export function canCreateCustomPlan(currentCount: number): boolean {
  // Etap 0: no limit enforced.
  // Etap 1: return isPro() || currentCount < FREE_CUSTOM_PLAN_LIMIT
  void currentCount
  return true
}

/**
 * Check if user has hit the free-tier publication limit.
 * Returns true if user can publish another plan.
 */
export function canPublishPlan(currentCount: number): boolean {
  // Etap 0: no limit enforced.
  // Etap 1: return isPro() || currentCount < FREE_PUBLICATION_LIMIT
  void currentCount
  return true
}

/**
 * Should the cloud sync be available?
 * Decision: cloud sync = Pro only (auth + community remain free).
 */
export function canCloudSync(): boolean {
  // Etap 0: no gating.
  // Etap 1: return isPro()
  return true
}

/**
 * Should export (CSV/JSON) be available?
 */
export function canExport(): boolean {
  // Etap 0: no gating.
  // Etap 1: return isPro()
  return true
}

/**
 * Should Web Push be available?
 */
export function canWebPush(): boolean {
  // Etap 0: no gating.
  // Etap 1: return isPro()
  return true
}

/**
 * Should hosted AI (SmartReps-provided key) be available?
 * BYOK AI remains free — this only gates the hosted variant.
 */
export function canUseHostedAi(): boolean {
  // Etap 0: no gating (hosted AI not implemented yet).
  // Etap 2: return isPro()
  return true
}

/**
 * Should advanced analytics (body-weight correlation, e1RM, muscle balance trends) be available?
 */
export function canUseAdvancedAnalytics(): boolean {
  // Etap 0: no gating.
  // Etap 1: return isPro()
  return true
}

/**
 * Etap 1 helper: enforce gating. Returns true if feature should be blocked.
 * UI should show ProTeaser when this returns true.
 */
export function isFeatureBlocked(feature: ProFeature): boolean {
  // Etap 0: nothing blocked.
  // Etap 1: return requiresPro(feature) && !isPro()
  void feature
  return false
}

// Re-export isPro for convenience
export { isPro }
