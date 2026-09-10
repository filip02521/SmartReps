import * as Sentry from '@sentry/react'

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

/** Known product events — extend here for dashboards/alerts. */
export const AnalyticsEvents = {
  sessionLostUnexpected: 'session_lost_unexpected',
  sessionRestoredFromIdb: 'session_restored_from_idb',
  importBackupOk: 'import_backup_ok',
  importBackupFail: 'import_backup_fail',
  accountDeleted: 'account_deleted',
  shareCard: 'share_card',
  pwaUpdateReload: 'pwa_update_reload',
  clientError: 'client_error',
  syncFailed: 'sync_failed',
  syncOk: 'sync_ok',
  syncSectionError: 'sync_section_error',
  syncSection: 'sync_section',
  syncResult: 'sync_result',
  onboardingStarted: 'onboarding_started',
  onboardingStep: 'onboarding_step',
  onboardingComplete: 'onboarding_complete',
  programSelected: 'program_selected',
  firstWorkoutStarted: 'first_workout_started',
  firstWorkoutDone: 'first_workout_done',
  chunkLoadError: 'chunk_load_error',
  webVitals: 'web_vitals',
  // Workout / session lifecycle
  dayCompleted: 'day_completed',
  sessionDeleted: 'session_deleted',
  retestStart: 'retest_start',
  levelChange: 'level_change',
  achievementUnlock: 'achievement_unlock',
  // Auth / account
  otpVerifyOk: 'otp_verify_ok',
  otpVerifyFail: 'otp_verify_fail',
  accountSwitchPromptShown: 'account_switch_prompt_shown',
  accountSwitchCleared: 'account_switch_cleared',
  accountSwitchCancelled: 'account_switch_cancelled',
  accountSwitchWrongAccount: 'account_switch_wrong_account',
  loginCloudPromptShown: 'login_cloud_prompt_shown',
  loginCloudPromptClicked: 'login_cloud_prompt_clicked',
  // Push notifications
  pushSubscribeOk: 'push_subscribe_ok',
  pushSubscribeFail: 'push_subscribe_fail',
  pushUnsubscribeFail: 'push_unsubscribe_fail',
  pushReminderUpdateFail: 'push_reminder_update_fail',
  reminderToggle: 'reminder_toggle',
  // Community
  communityTrained: 'community_trained',
  communityImportTrained48h: 'community_import_trained_48h',
  communityImportError: 'community_import_error',
  communityUnpublishError: 'community_unpublish_error',
  // Custom plans
  customPlanUpdatedFromSession: 'custom_plan_updated_from_session',
  customPlanUpdateDiscarded: 'custom_plan_update_discarded',
  // Starter templates
  starterTemplateShown: 'starter_template_shown',
  starterTemplatePreviewed: 'starter_template_previewed',
  starterTemplateActivated: 'starter_template_activated',
  // PWA install
  standaloneTrue: 'standalone_true',
  a2hsPrompt: 'a2hs_prompt',
  // Weekly challenge
  challengeView: 'challenge_view',
  challengeSubmit: 'challenge_submit',
  challengeSubmitError: 'challenge_submit_error',
  challengeLeaderboardToggle: 'challenge_leaderboard_toggle',
} as const

export type AnalyticsEventName =
  | (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
  | string

let sentryReady = false

/** Optional Sentry — enabled when VITE_SENTRY_DSN is set. */
export function initErrorReporting(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()
  if (!dsn || sentryReady) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
  sentryReady = true
}

function addSyncBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!sentryReady) return
  Sentry.addBreadcrumb({
    category: 'sync',
    message,
    level: 'info',
    data,
  })
}

/** Product analytics — no PII. Uses window.va if available (Vercel Analytics
 *  script loaded). The script is only injected when Web Analytics is enabled
 *  on the Vercel project; otherwise track() is a silent no-op. */
export function track(event: AnalyticsEventName, payload?: AnalyticsPayload): void {
  try {
    if (import.meta.env.DEV) {
      console.info('[analytics]', event, payload ?? {})
    }
    const w = window as Window & {
      va?: (event: 'event', data: { name: string; data?: AnalyticsPayload }) => void
    }
    // Only send if the Vercel Analytics script has loaded window.va.
    // Without the script, the /_vercel/insights/event endpoint returns 500.
    if (typeof w.va === 'function') {
      const clean: Record<string, string | number | boolean> = {}
      if (payload) {
        for (const [k, v] of Object.entries(payload)) {
          if (v === null || v === undefined) continue
          clean[k] = v
        }
      }
      w.va('event', { name: event, data: Object.keys(clean).length ? clean : undefined })
    }
  } catch {
    // never break UX for analytics
  }
}

export function trackError(error: unknown, context?: string): void {
  // Log full error details for debugging — DexieError needs .name/.inner to diagnose
  const name = error instanceof Error ? error.name : typeof error
  const message = error instanceof Error ? error.message : String(error)
  const inner = error && typeof error === 'object' && 'inner' in error
    ? (error as { inner: unknown }).inner
    : undefined
  console.error('[error]', context, { name, message, inner, error })
  track(AnalyticsEvents.clientError, {
    context: context ?? null,
    message: message.slice(0, 120),
  })
  if (sentryReady) {
    Sentry.captureException(error, { extra: { context } })
  }
}

export function trackSessionLostUnexpected(): void {
  track(AnalyticsEvents.sessionLostUnexpected)
}

export function trackSessionRestoredFromIdb(): void {
  track(AnalyticsEvents.sessionRestoredFromIdb)
}

export function trackImportBackupOk(kind: 'csv' | 'json', added: number): void {
  addSyncBreadcrumb('import_backup_ok', { kind, added })
  track(AnalyticsEvents.importBackupOk, { kind, added })
}

export function trackImportBackupFail(reason: string): void {
  track(AnalyticsEvents.importBackupFail, { reason })
}

export function trackAccountDeleted(): void {
  track(AnalyticsEvents.accountDeleted)
}

export function trackShareCard(program: string, passed: boolean): void {
  track(AnalyticsEvents.shareCard, { program, passed })
}

export function trackPwaUpdateReload(): void {
  track(AnalyticsEvents.pwaUpdateReload)
}

export function trackSyncPath(message: string, data?: Record<string, unknown>): void {
  addSyncBreadcrumb(message, data)
}

/**
 * Track the beginning/completion of a sync section (e.g. pull sessions,
 * push body-weight). Useful for timing analysis and detecting which
 * sections are slow or never complete.
 * Never throws — analytics failure must not break sync.
 */
export function trackSyncSection(section: string, status: 'start' | 'complete', meta?: Record<string, unknown>): void {
  try {
    addSyncBreadcrumb(`section:${section}:${status}`, meta)
    track(AnalyticsEvents.syncSection, {
      section,
      status,
      ...meta,
    })
  } catch {
    // never break sync for analytics
  }
}

/**
 * Track a sync section error (e.g. pull sessions failed, push body-weight failed).
 * Sends a breadcrumb to Sentry + a product analytics event so sync failures
 * are visible in dashboards without reading console.warn in DevTools.
 * Never throws — analytics failure must not break sync.
 */
export function trackSyncError(section: string, error: unknown): void {
  try {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[sync] ${section} failed`, error)
    addSyncBreadcrumb(`error: ${section}`, { message: message.slice(0, 200) })
    track(AnalyticsEvents.syncSectionError, {
      section,
      message: message.slice(0, 120),
    })
    if (sentryReady) {
      Sentry.captureException(error, { extra: { syncSection: section } })
    }
  } catch {
    // never break sync for analytics
  }
}

/**
 * Track the final result of a syncWithRemote cycle — ok/fail, error count,
 * tombstone errors, and failure reason. This is the Trust metric from
 * docs/product.md: "niski odsetek sync_failed / OTP fail w PWA standalone".
 * Never throws — analytics failure must not break sync.
 */
export function trackSyncResult(result: {
  ok: boolean
  errors: number
  tombstoneErrors?: number
  reason?: string
}): void {
  try {
    addSyncBreadcrumb('sync_result', result)
    track(AnalyticsEvents.syncResult, {
      ok: result.ok,
      errors: result.errors,
      tombstoneErrors: result.tombstoneErrors ?? 0,
      reason: result.reason ?? null,
    })
    if (!result.ok && sentryReady) {
      Sentry.addBreadcrumb({
        category: 'sync',
        message: 'sync_failed',
        level: 'error',
        data: result,
      })
    }
  } catch {
    // never break sync for analytics
  }
}

/**
 * Initialize Web Vitals measurement. Reports CLS, LCP, INP, FCP, TTFB
 * as analytics events so performance regressions are visible in dashboards.
 * Call once at app startup.
 */
export async function initWebVitals(): Promise<void> {
  try {
    const { onCLS, onLCP, onFCP, onTTFB, onINP } = await import('web-vitals')
    const report = (metric: { name: string; value: number; rating: string }) => {
      track(AnalyticsEvents.webVitals, {
        metric: metric.name,
        value: Math.round(metric.value * 100) / 100,
        rating: metric.rating,
      })
    }
    onCLS(report)
    onLCP(report)
    onFCP(report)
    onTTFB(report)
    onINP(report)
  } catch {
    // web-vitals is optional — never break app startup
  }
}
