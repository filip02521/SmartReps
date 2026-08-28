import { track as vercelTrack } from '@vercel/analytics'
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

/** Product analytics — no PII. Vercel Analytics + optional window.va. */
export function track(event: AnalyticsEventName, payload?: AnalyticsPayload): void {
  try {
    if (import.meta.env.DEV) {
      console.info('[analytics]', event, payload ?? {})
    }
    const clean: Record<string, string | number | boolean> = {}
    if (payload) {
      for (const [k, v] of Object.entries(payload)) {
        if (v === null || v === undefined) continue
        clean[k] = v
      }
    }
    vercelTrack(event, Object.keys(clean).length ? clean : undefined)
    const w = window as Window & {
      va?: (event: 'event', data: { name: string; data?: AnalyticsPayload }) => void
    }
    w.va?.('event', { name: event, data: payload })
  } catch {
    // never break UX for analytics
  }
}

export function trackError(error: unknown, context?: string): void {
  console.error('[error]', context, error)
  track(AnalyticsEvents.clientError, {
    context: context ?? null,
    message: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
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
