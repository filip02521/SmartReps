/**
 * Subscription status and Pro feature gating logic.
 *
 * Etap 0: infrastructure only — no features are blocked yet.
 * Etap 1: Stripe webhook updates subscription_status in profiles;
 *         client pulls on sync and feature-gating.ts enforces limits.
 *
 * Status flow:
 *   free → trial (opt-in, 14 days) → pro (paid) / expired (trial ended)
 *   free → pro (paid, no trial) → expired (canceled + grace period over)
 *   free → lifetime (one-time purchase, never expires)
 */

import { useAppStore, type UserSettings } from '@/stores/app-store'

export type SubscriptionStatus = UserSettings['subscriptionStatus']

/** Duration of the opt-in free trial in days. */
export const TRIAL_DURATION_DAYS = 14

/**
 * Check if a subscription status + expiry constitutes active Pro access.
 * Pure function — safe to use in tests without Zustand.
 */
export function isProStatus(
  status: SubscriptionStatus,
  expiresAt: string | null,
  now: Date = new Date(),
): boolean {
  if (status === 'lifetime') return true
  if (status === 'pro') {
    if (!expiresAt) return true // defensive: no expiry = active
    return new Date(expiresAt) > now
  }
  if (status === 'trial') {
    // Trial is active during the 14-day window from trialStartedAt.
    // subscriptionExpiresAt for trial = trial end date.
    if (!expiresAt) return true // defensive
    return new Date(expiresAt) > now
  }
  return false
}

/**
 * Non-reactive Pro check. Use in lib/ code, event handlers, tests.
 * For React components, prefer useProFeatures() (reactive).
 */
export function isPro(): boolean {
  const { settings } = useAppStore.getState()
  return isProStatus(settings.subscriptionStatus, settings.subscriptionExpiresAt)
}

/**
 * Reactive Pro check for React components. Re-renders when status changes.
 */
export function useProFeatures(): boolean {
  return useAppStore((s) =>
    isProStatus(s.settings.subscriptionStatus, s.settings.subscriptionExpiresAt),
  )
}

/**
 * Check if user is currently in trial (not just Pro, but specifically trial).
 */
export function useIsTrial(): boolean {
  return useAppStore((s) => s.settings.subscriptionStatus === 'trial')
}

/**
 * Check if user has lifetime access.
 */
export function useIsLifetime(): boolean {
  return useAppStore((s) => s.settings.subscriptionStatus === 'lifetime')
}

/**
 * Days remaining in current subscription or trial.
 * Returns null for lifetime or free (no expiry).
 */
export function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Has the user ever started a trial? (trialStartedAt is non-null)
 * Used to prevent re-trialing the same user.
 */
export function hasUsedTrial(): boolean {
  return useAppStore.getState().settings.trialStartedAt !== null
}

/**
 * Compute trial end date from a start date.
 */
export function trialEndDate(trialStartedAt: string): string {
  const end = new Date(trialStartedAt)
  end.setDate(end.getDate() + TRIAL_DURATION_DAYS)
  return end.toISOString()
}

/**
 * Opt-in trial start. Called when user explicitly clicks "Start free trial".
 * In Etap 1, this will also create a Stripe trial subscription via webhook.
 * In Etap 0, this is a no-op placeholder (trial requires Stripe backend).
 *
 * Returns false if trial cannot be started (already used, already Pro).
 */
export function startTrial(): boolean {
  const { settings } = useAppStore.getState()
  if (settings.subscriptionStatus !== 'free') return false
  if (settings.trialStartedAt) return false // already used trial

  // Etap 0: cannot actually start trial without Stripe backend.
  // This function is a placeholder — real implementation in Etap 1.
  // Etap 1 will: redirect to Stripe Checkout with trial_period_days=14,
  // Stripe webhook will update profiles.subscription_status='trial'.
  return false
}
