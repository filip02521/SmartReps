/**
 * Subscription status and Pro feature gating logic.
 *
 * Etap 1 active: limits are enforced (feature-gating.ts); the self-serve
 * trial runs via the `start_trial` RPC (migration 067). Next: Stripe
 * webhook updates subscription_status in profiles; client pulls on sync.
 * Server-side, the subscription columns are write-protected by the
 * protect_subscription_fields trigger (migration 080) — clients can only
 * change them through SECURITY DEFINER RPCs.
 *
 * Status flow:
 *   free → trial (opt-in, 14 days) → pro (paid) / expired (trial ended)
 *   free → pro (paid, no trial) → expired (canceled + grace period over)
 *   free → lifetime (one-time purchase, never expires)
 */

import { supabase } from '@/lib/supabase/client'
import { safeJsonParse } from '@/lib/utils'
import { AnalyticsEvents, track } from '@/lib/analytics'
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

// ── Plan badge state ──

/** Trial chip switches to warning tone when this many days (or fewer) remain. */
export const TRIAL_ENDING_SOON_DAYS = 3

/**
 * Collapsed subscription state for UI badges — single source of truth.
 * 'pro' means a paid subscription; 'trial' is reported separately so the UI
 * can show the countdown; 'expired' covers both an ended subscription and a
 * lapsed trial (status stays 'trial' until the server marks it expired).
 */
export type PlanBadgeState = 'free' | 'trial' | 'pro' | 'lifetime' | 'expired'

export function planBadgeState(
  status: SubscriptionStatus,
  expiresAt: string | null,
  now: Date = new Date(),
): PlanBadgeState {
  if (status === 'lifetime') return 'lifetime'
  if (isProStatus(status, expiresAt, now)) {
    return status === 'trial' ? 'trial' : 'pro'
  }
  // Any non-free status that isn't currently active = lapsed: trial past its
  // window, 'expired' from the server, or 'pro' whose expires_at passed but
  // the status flip hasn't happened yet. All prompt renewal, not upsell.
  if (status !== 'free') return 'expired'
  return 'free'
}

/** Reactive badge state for React components. */
export function usePlanBadgeState(): PlanBadgeState {
  return useAppStore((s) =>
    planBadgeState(s.settings.subscriptionStatus, s.settings.subscriptionExpiresAt),
  )
}

// ── Trial expiry analytics ──

let trialExpiryTracked = false

/**
 * Funnel event for a lapsed trial — fires once per app session when we
 * observe status='trial' whose window already passed. Nothing flips the
 * server status to 'expired' (no cron), so the client-side observation is
 * the measurement point. Call on Dashboard mount.
 */
export function trackTrialExpiryIfNeeded(): void {
  if (trialExpiryTracked) return
  const { settings } = useAppStore.getState()
  if (settings.subscriptionStatus !== 'trial') return
  if (isProStatus('trial', settings.subscriptionExpiresAt)) return
  trialExpiryTracked = true
  track(AnalyticsEvents.proTrialExpired)
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

/** Outcome of a self-serve trial start — lets callers pick copy/redirect. */
export type StartTrialResult =
  | 'ok'
  | 'not_authenticated' // trial requires an account → send user to login
  | 'already_used'      // trial_started_at is set (permanent, one-time)
  | 'already_pro'       // active pro/lifetime/trial
  | 'error'             // network / server error

/**
 * Opt-in trial start — self-serve via the `start_trial` RPC (migration 067),
 * no Stripe required. The server enforces one-trial-per-account and sets
 * `subscription_status='trial'` + `subscription_expires_at = now()+14d`;
 * we mirror the result into the local store so the UI flips to Pro
 * immediately (no full sync needed).
 */
export async function startTrial(): Promise<StartTrialResult> {
  const { settings } = useAppStore.getState()
  if (settings.trialStartedAt) return 'already_used'
  if (isProStatus(settings.subscriptionStatus, settings.subscriptionExpiresAt)) {
    return 'already_pro'
  }

  const { data, error } = await supabase.rpc('start_trial')
  if (error) return 'error'

  const raw = safeJsonParse<{ error?: string; expires_at?: string; trial_started_at?: string }>(data)
  if (!raw) return 'error'
  if (raw.error === 'not_authenticated') return 'not_authenticated'
  if (raw.error === 'trial_already_used') return 'already_used'
  if (raw.error === 'already_pro') return 'already_pro'
  if (raw.error) return 'error'

  useAppStore
    .getState()
    .setSubscriptionStatus('trial', raw.expires_at ?? null, raw.trial_started_at ?? null)
  return 'ok'
}
