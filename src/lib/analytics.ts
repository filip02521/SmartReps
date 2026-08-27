import { track as vercelTrack } from '@vercel/analytics'
import * as Sentry from '@sentry/react'

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

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

/** Product analytics — no PII. Vercel Analytics + optional window.va. */
export function track(event: string, payload?: AnalyticsPayload): void {
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
  track('client_error', {
    context: context ?? null,
    message: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
  })
  if (sentryReady) {
    Sentry.captureException(error, { extra: { context } })
  }
}
