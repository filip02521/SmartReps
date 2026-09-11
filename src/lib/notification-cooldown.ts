/**
 * Shared notification cooldown — prevents repeated "session expired" toasts
 * when multiple sync triggers fire (online event, visibility change, boot sync,
 * manual sync, post-workout sync, etc.).
 *
 * Before this module, `notifyUnexpectedSessionLoss` (SIGNED_OUT event) had an
 * 8-second dedup, but `scheduleSyncResultToast` (every sync attempt) had NO
 * dedup for `auth_expired` — it always showed a toast. This caused the user
 * to see 2+ "session expired" notifications every time they switched apps or
 * reconnected, which was reported as annoying.
 *
 * This module unifies the cooldown: once the user is notified that their
 * session expired, further session-expired toasts are suppressed for
 * SESSION_EXPIRED_COOLDOWN_MS. The cooldown resets when the user logs in
 * again (clearSignedOutPreference / SIGNED_IN).
 */

/** Cooldown period for session-expired notifications (5 minutes). */
const SESSION_EXPIRED_COOLDOWN_MS = 5 * 60 * 1000

let lastSessionExpiredToastAt = 0

/** Returns true if a session-expired toast was shown recently and should be suppressed. */
export function isSessionExpiredToastInCooldown(): boolean {
  return Date.now() - lastSessionExpiredToastAt < SESSION_EXPIRED_COOLDOWN_MS
}

/** Records that a session-expired toast was just shown. */
export function markSessionExpiredToastShown(): void {
  lastSessionExpiredToastAt = Date.now()
}

/** Resets the cooldown — call on successful login (SIGNED_IN / clearSignedOutPreference). */
export function resetSessionExpiredToastCooldown(): void {
  lastSessionExpiredToastAt = 0
}

/** Test-only: reset internal state between test cases. */
export function __resetSessionExpiredCooldownForTests(): void {
  lastSessionExpiredToastAt = 0
}
