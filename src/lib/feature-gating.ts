/**
 * Feature gating for freemium model.
 *
 * Limits are active (Etap 1): call canUseFeature()/the can*() helpers before
 * Pro-only features; show ProTeaser when blocked. Publication count is also
 * enforced server-side in the publish_community_plan RPC (migration 079).
 *
 * Gating philosophy:
 * - Core training (23 cycles, 3 custom plans) = FREE (growth driver)
 * - Community (browse, import, publish max 3, follow) = FREE (network effect)
 * - Cloud sync = FREE (data safety across devices — business decision: gating
 *   it would punish engaged users at device-switch time for near-zero infra
 *   cost; Pro focuses on additive value instead)
 * - Hosted AI + BYOK, unlimited plans, advanced analytics, export, web push = PRO
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
 * 'cloudSync' stays in the union as a deep-link/row identifier (comparison
 * table, teaser) but is NOT gated — sync is free for everyone.
 */
export function requiresPro(feature: ProFeature): boolean {
  // 'cloudSync' and 'manualShowcase' stay in the union as deep-link/row
  // identifiers but are NOT gated — sync is a baseline expectation (business
  // decision #5) and manual showcase moved to Free (profile personalization
  // drives community engagement; too thin to sell alone).
  return feature !== 'cloudSync' && feature !== 'manualShowcase'
}

/**
 * Can the current user use a Pro feature?
 * All ProFeature members are Pro-only → free users get false.
 */
export function canUseFeature(feature: ProFeature): boolean {
  return !isFeatureBlocked(feature)
}

/**
 * Check if user has hit the free-tier custom plan limit.
 * Returns true if user can create another custom plan.
 */
export function canCreateCustomPlan(currentCount: number): boolean {
  return isPro() || currentCount < FREE_CUSTOM_PLAN_LIMIT
}

/**
 * Check if user has hit the free-tier publication limit.
 * Returns true if user can publish another plan.
 */
export function canPublishPlan(currentCount: number): boolean {
  return isPro() || currentCount < FREE_PUBLICATION_LIMIT
}

/**
 * Should the cloud sync be available?
 * Decision (updated): cloud sync = FREE for everyone — data safety across
 * devices is a baseline expectation, not a premium. See business-model.md.
 */
export function canCloudSync(): boolean {
  return true
}

/**
 * Should CSV export be available? JSON backup moved to Free (data
 * portability is an ethical baseline — the user's data is theirs); CSV
 * stays Pro as the "pretty" reporting format.
 */
export function canExport(): boolean {
  return isPro()
}

/**
 * Should Web Push be available?
 */
export function canWebPush(): boolean {
  return isPro()
}

/**
 * Should AI features be available? AI is Pro-only — hard paywall covering
 * hosted SmartReps AI and BYOK alike. The ai-proxy Edge Function enforces
 * the same rule server-side (403 pro_required for free users).
 */
export function canUseHostedAi(): boolean {
  return isPro()
}

/**
 * Should advanced analytics (body-weight correlation, e1RM, muscle balance trends) be available?
 */
export function canUseAdvancedAnalytics(): boolean {
  return isPro()
}

/**
 * Manual achievement-showcase selection — FREE for everyone since the
 * feature-mix review (drives public profile personalization and community
 * engagement; too thin to justify a paywall on its own).
 */
export function canUseManualShowcase(): boolean {
  return true
}

/**
 * Should the verified author badge show in the community catalog?
 */
export function canUseVerifiedBadge(): boolean {
  return isPro()
}

/**
 * Enforce gating. Returns true if feature should be blocked.
 * UI should show ProTeaser when this returns true.
 */
export function isFeatureBlocked(feature: ProFeature): boolean {
  return requiresPro(feature) && !isPro()
}

// Re-export isPro for convenience
export { isPro }
